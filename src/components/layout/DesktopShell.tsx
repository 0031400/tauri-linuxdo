import { useEffect, useRef, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { Button, Card, CardContent, CircularProgress } from "@mui/material";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  fetchTopicCategories,
  hydrateLinuxDoCookieHeader,
  hasLinuxDoSession,
  logoutLinuxDo,
  openLinuxDoLogin,
  setLinuxDoCookieHeader,
} from "../../api/linuxdo";
import type { TopicCategory } from "../../types/topic";
import { readLayoutNumber, writeLayoutNumber } from "../../utils/layoutStore";
import { notifySessionChanged, SESSION_EVENT } from "../../utils/session";

type LoginStatusPayload = {
  cookie_header: string;
};

export function DesktopShell() {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const isMinimal = query.get("minimal") === "1";
  const currentCategory = query.get("category")?.trim() || "";
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

  useEffect(() => {
    if (isMinimal) return;

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
  }, [isMinimal]);

  useEffect(() => {
    void readLayoutNumber("layout.sidebarWidth", 240).then((value) => {
      setSidebarWidth(Math.max(180, Math.min(420, Math.round(value))));
      setSidebarWidthReady(true);
    });
  }, []);

  useEffect(() => {
    if (!sidebarWidthReady || isMinimal) return;
    const timer = window.setTimeout(() => {
      void writeLayoutNumber("layout.sidebarWidth", sidebarWidth);
    }, 1000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [isMinimal, sidebarWidth, sidebarWidthReady]);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!draggingSidebarRef.current || isMinimal) return;
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
  }, [isMinimal]);

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
        const items = await fetchTopicCategories();
        setCategories(items);
      } catch {
        setCategories([]);
      }
    };

    const handleSessionChange = () => {
      void (async () => {
        const ok = await refreshSession();
        if (ok) {
          await loadCategories();
        } else {
          setCategories([]);
        }
      })();
    };

    let unlistenLoginStatus: (() => void) | undefined;

    void (async () => {
      try {
        await hydrateLinuxDoCookieHeader();
        const ok = await refreshSession();
        if (ok) {
          await loadCategories();
        } else {
          setCategories([]);
        }
      } finally {
        setInitializing(false);
      }
    })();

    window.addEventListener(SESSION_EVENT, handleSessionChange);
    void listen<LoginStatusPayload>("linuxdo-login-status", async (event) => {
      await setLinuxDoCookieHeader(event.payload.cookie_header);
      setOpeningLogin(false);
      const ok = await refreshSession();
      if (ok) {
        await loadCategories();
      } else {
        setCategories([]);
      }
      notifySessionChanged();
    }).then((unlisten) => {
      unlistenLoginStatus = unlisten;
    });

    return () => {
      window.removeEventListener(SESSION_EVENT, handleSessionChange);
      unlistenLoginStatus?.();
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
      setCategories([]);
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
            <span className="text-sm text-slate-600">加载中...</span>
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

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-4 text-slate-900">
      <div ref={layoutRootRef} className="mx-auto flex h-[calc(100vh-2rem)] max-w-[1500px] gap-4">
        <aside className="shrink-0" style={{ width: `${sidebarWidth}px` }}>
          <Card className="h-full rounded-2xl border border-slate-200 shadow-md shadow-slate-200/60">
            <CardContent className="flex h-full min-h-0 flex-col gap-4 overflow-hidden p-4">
              <div className="text-2xl font-semibold text-slate-900">linux.do</div>

              <div className="min-h-0 flex-1 overflow-y-auto rounded-xl bg-slate-50 p-1">
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm font-medium text-slate-700 hover:bg-slate-100"
                  onClick={() => setCategoryOpen((current) => !current)}
                >
                  <span>类别</span>
                  <span className="text-xs text-slate-500">{categoryOpen ? "收起" : "展开"}</span>
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
                      全部
                    </NavLink>
                    {categories.map((category) => {
                      const active = location.pathname === "/topics" && currentCategory === category.slug;
                      return (
                        <NavLink
                          key={category.id}
                          to={`/topics?category=${encodeURIComponent(category.slug)}`}
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
                    {loggingOut ? "退出中..." : "退出登录"}
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
                    {openingLogin ? "登录中..." : "登录"}
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
