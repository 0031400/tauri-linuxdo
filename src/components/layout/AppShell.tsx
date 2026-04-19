import { Card, CardContent } from "@mui/material";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { getPlatformCapabilities } from "../../utils/platform";
import { appTabs } from "./appNav";

function isHomePath(pathname: string) {
  return pathname === "/home" || pathname === "/topics";
}

export function AppShell() {
  const location = useLocation();
  const { isMobile } = getPlatformCapabilities();
  const query = new URLSearchParams(location.search);
  const isMinimal = query.get("minimal") === "1";
  const selectedCategory = query.get("category")?.trim() ?? "";

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
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <div
        className={[
          "mx-auto",
          isMobile
            ? "min-h-screen max-w-[800px] px-3 pb-20 pt-3"
            : "flex max-w-[1680px] gap-4 px-4 py-4",
        ].join(" ")}
      >
        {isMobile ? null : (
          <aside className="sticky top-4 h-[calc(100vh-2rem)] w-[280px] shrink-0">
            <Card className="h-full rounded-[28px] border border-slate-200 bg-white shadow-md shadow-slate-200/60">
              <CardContent className="flex h-full flex-col gap-5 p-4">
                <div className="rounded-[24px] bg-slate-900 px-4 py-5 text-white">
                  <div className="text-xs uppercase tracking-[0.3em] text-slate-300">Windows</div>
                  <div className="mt-2 text-2xl font-semibold">linux.do</div>
                  <div className="mt-1 text-sm text-slate-300">左侧菜单版布局</div>
                </div>

                <nav className="space-y-2">
                  {appTabs.map((tab) => {
                    const to =
                      tab.key === "categories" && selectedCategory
                        ? `/categories?selected=${encodeURIComponent(selectedCategory)}`
                        : tab.to;
                    const active =
                      tab.key === "home"
                        ? isHomePath(location.pathname)
                        : location.pathname === tab.to;

                    return (
                      <NavLink
                        key={tab.key}
                        to={to}
                        className={[
                          "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition",
                          active
                            ? "bg-slate-900 text-white shadow-sm"
                            : "bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "h-2.5 w-2.5 rounded-full transition",
                            active ? "bg-white" : "bg-slate-300",
                          ].join(" ")}
                        />
                        <span>{tab.label}</span>
                      </NavLink>
                    );
                  })}
                </nav>

                <div className="mt-auto rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  Home 看帖子，Categories 切分类，Profile 管登录。
                </div>
              </CardContent>
            </Card>
          </aside>
        )}

        <section className={isMobile ? "" : "min-w-0 flex-1"}>
          <Outlet />
        </section>
      </div>

      {isMobile ? (
        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto grid h-16 max-w-[800px] grid-cols-3 gap-2 px-3 py-2">
            {appTabs.map((tab) => {
              const to =
                tab.key === "categories" && selectedCategory
                  ? `/categories?selected=${encodeURIComponent(selectedCategory)}`
                  : tab.to;
              return (
                <NavLink
                  key={tab.key}
                  to={to}
                  className={({ isActive }) =>
                    [
                      "flex items-center justify-center rounded-xl text-sm font-medium transition",
                      isActive ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100",
                    ].join(" ")
                  }
                >
                  {tab.label}
                </NavLink>
              );
            })}
          </div>
        </nav>
      ) : null}
    </main>
  );
}
