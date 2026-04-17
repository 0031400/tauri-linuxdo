import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { Button, Card, CardContent, CircularProgress } from "@mui/material";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  clearTopicCategoriesCache,
  fetchAllTopicCategories,
  hydrateLinuxDoCookieHeader,
  hasLinuxDoSession,
  logoutLinuxDo,
  openLinuxDoLogin,
  setLinuxDoCookieHeader,
  takePendingLinuxDoLoginCookie,
} from "../../api/linuxdo";
import type { TopicCategory } from "../../types/topic";
import { readLayoutNumber, writeLayoutNumber } from "../../utils/layoutStore";
import { getPlatformCapabilities } from "../../utils/platform";
import { notifySessionChanged, SESSION_EVENT } from "../../utils/session";

type LevelOption = {
  key: string;
  label: string;
  categoryIds: number[];
};

function getLevelNumber(category: TopicCategory) {
  const source = `${category.name} ${category.slug}`.toLowerCase();
  const match = source.match(/lv\s*([0-9]+)/i);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) && value > 0 ? value : null;
}

export function DesktopShell() {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const isMinimal = query.get("minimal") === "1";
  const currentCategory = query.get("category")?.trim() || "";
  const { isMobile, supportsWindowResize } = getPlatformCapabilities();
  const layoutRootRef = useRef<HTMLDivElement | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [sidebarWidthReady, setSidebarWidthReady] = useState(false);
  const draggingSidebarRef = useRef(false);
  const [initializing, setInitializing] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [checkingSession, setCheckingSession] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [openingLogin, setOpeningLogin] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(true);
  const [categories, setCategories] = useState<TopicCategory[]>([]);
  const [levelOptions, setLevelOptions] = useState<LevelOption[]>([]);
  const [categoryLevel, setCategoryLevel] = useState("all");

  const levelCategoryIdSet = useMemo(() => {
    const result = new Set<number>();
    for (const option of levelOptions) {
      for (const id of option.categoryIds) {
        result.add(id);
      }
    }
    return result;
  }, [levelOptions]);

  const visibleCategories = useMemo(() => {
    if (categoryLevel === "all") {
      return categories.filter((item) => !levelCategoryIdSet.has(item.id));
    }
    const matched = levelOptions.find((item) => item.key === categoryLevel);
    if (!matched) return categories;
    const idSet = new Set(matched.categoryIds);
    return categories.filter((item) => idSet.has(item.id));
  }, [categories, categoryLevel, levelCategoryIdSet, levelOptions]);

  const categoryPathById = useMemo(() => {
    const categoryById = new Map<number, TopicCategory>();
    for (const category of categories) {
      categoryById.set(category.id, category);
    }

    const result = new Map<number, string>();
    for (const category of categories) {
      const parentId = category.parent_category_id;
      if (parentId) {
        const parent = categoryById.get(parentId);
        if (parent?.slug) {
          result.set(category.id, `${parent.slug}/${category.slug}`);
          continue;
        }
      }
      result.set(category.id, category.slug);
    }
    return result;
  }, [categories]);

  useEffect(() => {
    if (isMinimal || !supportsWindowResize) return;

    const appWindow = getCurrentWindow();
    let unlistenResized: (() => void) | undefined;
    let saveTimer: number | undefined;
    let disposed = false;

    const clampWindowWidth = (value: number) => Math.max(720, Math.min(3000, Math.round(value)));
    const clampWindowHeight = (value: number) => Math.max(540, Math.min(2200, Math.round(value)));
    const normalizeMaybePhysical = (saved: number, currentLogical: number, scale: number) => {
      if (saved > currentLogical * 1.25) {
        return saved / Math.max(scale, 1);
      }
      return saved;
    };

    void (async () => {
      try {
        const scaleFactor = await appWindow.scaleFactor();
        const currentSize = await appWindow.innerSize();
        const currentLogicalWidth = currentSize.width / Math.max(scaleFactor, 1);
        const currentLogicalHeight = currentSize.height / Math.max(scaleFactor, 1);
        const [savedWidth, savedHeight] = await Promise.all([
          readLayoutNumber("layout.mainWindowWidth", currentLogicalWidth),
          readLayoutNumber("layout.mainWindowHeight", currentLogicalHeight),
        ]);
        const targetLogicalWidth = normalizeMaybePhysical(savedWidth, currentLogicalWidth, scaleFactor);
        const targetLogicalHeight = normalizeMaybePhysical(savedHeight, currentLogicalHeight, scaleFactor);
        if (!disposed) {
          await appWindow.setSize(
            new LogicalSize(
              clampWindowWidth(targetLogicalWidth),
              clampWindowHeight(targetLogicalHeight),
            ),
          );
        }
      } catch (error) {
        console.error(error);
      }

      try {
        unlistenResized = await appWindow.onResized(({ payload: size }) => {
          if (saveTimer) {
            window.clearTimeout(saveTimer);
          }
          saveTimer = window.setTimeout(() => {
            const scale = Math.max(window.devicePixelRatio || 1, 1);
            void Promise.all([
              writeLayoutNumber("layout.mainWindowWidth", clampWindowWidth(size.width / scale)),
              writeLayoutNumber("layout.mainWindowHeight", clampWindowHeight(size.height / scale)),
            ]);
          }, 1000);
        });
      } catch (error) {
        console.error(error);
      }
    })();

    return () => {
      disposed = true;
      if (saveTimer) {
        window.clearTimeout(saveTimer);
      }
      unlistenResized?.();
    };
  }, [isMinimal, supportsWindowResize]);

  useEffect(() => {
    if (isMobile) return;
    void readLayoutNumber("layout.sidebarWidth", 240).then((value) => {
      setSidebarWidth(Math.max(180, Math.min(420, Math.round(value))));
      setSidebarWidthReady(true);
    });
  }, [isMobile]);

  useEffect(() => {
    if (isMobile || !sidebarWidthReady || isMinimal) return;
    const timer = window.setTimeout(() => {
      void writeLayoutNumber("layout.sidebarWidth", sidebarWidth);
    }, 1000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [isMinimal, isMobile, sidebarWidth, sidebarWidthReady]);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!draggingSidebarRef.current || isMinimal || isMobile) return;
      const rootRect = layoutRootRef.current?.getBoundingClientRect();
      if (!rootRect) return;
      const next = Math.max(180, Math.min(420, Math.round(event.clientX - rootRect.left)));
      setSidebarWidth(next);
    };

    const onMouseUp = () => {
      draggingSidebarRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isMinimal, isMobile]);

  useEffect(() => {
    const refreshSession = async () => {
      setCheckingSession(true);
      try {
        const nextLoggedIn = await hasLinuxDoSession();
        setLoggedIn(nextLoggedIn);
        return nextLoggedIn;
      } catch {
        setLoggedIn(false);
        return false;
      } finally {
        setCheckingSession(false);
      }
    };

    const loadCategories = async () => {
      try {
        const items = await fetchAllTopicCategories();
        setCategories(items);

        const grouped = new Map<number, TopicCategory[]>();
        for (const item of items) {
          if (!item.parent_category_id) continue;
          const level = getLevelNumber(item);
          if (!level) continue;
          const list = grouped.get(level) ?? [];
          list.push(item);
          grouped.set(level, list);
        }
        const options = Array.from(grouped.entries())
          .sort((a, b) => a[0] - b[0])
          .map(([level, list]) => ({
            key: `lv${level}`,
            label: `Lv${level}`,
            categoryIds: list.map((item) => item.id),
          }));
        setLevelOptions(options);
      } catch {
        setCategories([]);
        setLevelOptions([]);
      }
    };

    const handleSessionChange = () => {
      void (async () => {
        const ok = await refreshSession();
        if (ok) {
          await loadCategories();
        } else {
          clearTopicCategoriesCache();
          setCategories([]);
          setLevelOptions([]);
        }
      })();
    };

    void (async () => {
      try {
        await hydrateLinuxDoCookieHeader();
        const pendingCookieHeader = await takePendingLinuxDoLoginCookie();
        if (typeof pendingCookieHeader === "string" && pendingCookieHeader.trim()) {
          await setLinuxDoCookieHeader(pendingCookieHeader);
        }
        const ok = await refreshSession();
        if (ok) {
          await loadCategories();
        } else {
          clearTopicCategoriesCache();
          setCategories([]);
          setLevelOptions([]);
        }
      } finally {
        setOpeningLogin(false);
        setInitializing(false);
      }
    })();

    window.addEventListener(SESSION_EVENT, handleSessionChange);

    return () => {
      window.removeEventListener(SESSION_EVENT, handleSessionChange);
    };
  }, []);

  const handleLogin = async () => {
    setOpeningLogin(true);
    try {
      await openLinuxDoLogin();
    } catch (error) {
      console.error(error);
      setOpeningLogin(false);
    }
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutLinuxDo();
      clearTopicCategoriesCache();
      setCategories([]);
      setLevelOptions([]);
      notifySessionChanged();
    } catch (error) {
      console.error(error);
    } finally {
      setLoggingOut(false);
    }
  };

  if (initializing) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-4 text-slate-900">
        <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-[1500px] items-center justify-center">
          <div className="flex items-center gap-3 rounded-2xl bg-white px-5 py-4 shadow-sm">
            <CircularProgress size={22} />
            <span className="text-sm text-slate-600">Loading...</span>
          </div>
        </div>
      </main>
    );
  }

  if (isMinimal) {
    return (
      <main className="min-h-screen bg-slate-100 px-3 py-3 text-slate-900">
        <div className="mx-auto min-h-[calc(100vh-1.5rem)] max-w-[1400px]">
          <Outlet />
        </div>
      </main>
    );
  }

  if (isMobile) {
    return (
      <main className="min-h-screen bg-slate-100 px-3 py-3 text-slate-900">
        <div className="mx-auto flex min-h-[calc(100vh-1.5rem)] max-w-[800px] flex-col gap-3">
          <Card className="rounded-2xl border border-slate-200 shadow-sm">
            <CardContent className="space-y-3 p-3">
              <div className="text-lg font-semibold text-slate-900">linux.do</div>
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-xs text-slate-500">Level</span>
                <button
                  type="button"
                  className={[
                    "rounded-md px-2 py-1 text-xs transition",
                    categoryLevel === "all"
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  ].join(" ")}
                  onClick={() => setCategoryLevel("all")}
                >
                  All
                </button>
                {levelOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={[
                      "rounded-md px-2 py-1 text-xs transition",
                      categoryLevel === option.key
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                    ].join(" ")}
                    onClick={() => setCategoryLevel(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <NavLink
                  to="/topics"
                  className={[
                    "shrink-0 rounded-lg px-2 py-1.5 text-sm transition",
                    location.pathname === "/topics" && !currentCategory
                      ? "bg-slate-900 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  ].join(" ")}
                >
                  All Categories
                </NavLink>
                {visibleCategories.map((category) => {
                  const categoryPath = categoryPathById.get(category.id) ?? category.slug;
                  const active = location.pathname === "/topics" && currentCategory === categoryPath;
                  return (
                    <NavLink
                      key={category.id}
                      to={`/topics?category=${encodeURIComponent(categoryPath)}`}
                      className={[
                        "shrink-0 rounded-lg px-2 py-1.5 text-sm transition",
                        active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                      ].join(" ")}
                    >
                      {category.name}
                    </NavLink>
                  );
                })}
              </div>
              <div>
                {loggedIn ? (
                  <Button
                    fullWidth
                    variant="outlined"
                    className="h-9 rounded-xl"
                    onClick={() => {
                      void handleLogout();
                    }}
                    disabled={checkingSession || loggingOut}
                  >
                    {loggingOut ? "Logging out..." : "Logout"}
                  </Button>
                ) : (
                  <Button
                    fullWidth
                    variant="contained"
                    className="h-9 rounded-xl"
                    onClick={() => {
                      void handleLogin();
                    }}
                    disabled={checkingSession || openingLogin}
                  >
                    {openingLogin ? "Logging in..." : "Login"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <section className="min-h-0 flex-1">
            <Outlet />
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-4 text-slate-900">
      <div ref={layoutRootRef} className="mx-auto flex h-[calc(100vh-2rem)] max-w-[1500px] gap-4">
        <aside className="shrink-0" style={{ width: `${sidebarWidth}px` }}>
          <Card className="h-full rounded-2xl border border-slate-200 shadow-md shadow-slate-200/60">
            <CardContent className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4">
              <div className="text-2xl font-semibold text-slate-900">linux.do</div>

              <div className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-slate-50 p-1">
                <div className="mb-1.5 flex items-center gap-1 px-1 py-1">
                  <span className="text-xs text-slate-500">Level</span>
                  <button
                    type="button"
                    className={[
                      "rounded-md px-1.5 py-0.5 text-xs transition",
                      categoryLevel === "all"
                        ? "bg-slate-900 text-white"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                    ].join(" ")}
                    onClick={() => setCategoryLevel("all")}
                  >
                    All
                  </button>
                  {levelOptions.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={[
                        "rounded-md px-1.5 py-0.5 text-xs transition",
                        categoryLevel === option.key
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                      ].join(" ")}
                      onClick={() => setCategoryLevel(option.key)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                  onClick={() => setCategoryOpen((current) => !current)}
                >
                  <span>Categories</span>
                  <span className="text-xs text-slate-500">{categoryOpen ? "Collapse" : "Expand"}</span>
                </button>

                {categoryOpen ? (
                  <div className="mt-1 space-y-1 px-1 pb-1">
                    <NavLink
                      to="/topics"
                      className={[
                        "block rounded-lg px-2 py-1.5 text-sm transition",
                        location.pathname === "/topics" && !currentCategory
                          ? "bg-slate-900 text-white"
                          : "text-slate-600 hover:bg-slate-100",
                      ].join(" ")}
                    >
                      All Categories
                    </NavLink>
                    {visibleCategories.map((category) => {
                      const categoryPath = categoryPathById.get(category.id) ?? category.slug;
                      const active = location.pathname === "/topics" && currentCategory === categoryPath;
                      return (
                        <NavLink
                          key={category.id}
                          to={`/topics?category=${encodeURIComponent(categoryPath)}`}
                          className={[
                            "block rounded-lg px-2 py-1.5 text-sm transition",
                            active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100",
                          ].join(" ")}
                        >
                          {category.name}
                        </NavLink>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <div className="mt-auto">
                {loggedIn ? (
                  <Button
                    fullWidth
                    variant="outlined"
                    className="h-9 rounded-xl"
                    onClick={() => {
                      void handleLogout();
                    }}
                    disabled={checkingSession || loggingOut}
                  >
                    {loggingOut ? "Logging out..." : "Logout"}
                  </Button>
                ) : (
                  <Button
                    fullWidth
                    variant="contained"
                    className="h-9 rounded-xl"
                    onClick={() => {
                      void handleLogin();
                    }}
                    disabled={checkingSession || openingLogin}
                  >
                    {openingLogin ? "Logging in..." : "Login"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>

        <div
          className="w-1 shrink-0 cursor-col-resize rounded bg-slate-200/80 hover:bg-slate-300"
          onMouseDown={() => {
            draggingSidebarRef.current = true;
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
          }}
        />

        <section className="min-w-0 flex-1">
          <Outlet />
        </section>
      </div>
    </main>
  );
}
