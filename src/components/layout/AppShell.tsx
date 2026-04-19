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
            ? "min-h-screen max-w-[800px] px-3 pb-20 pt-[calc(env(safe-area-inset-top)+0.75rem)]"
            : "flex max-w-[1680px] gap-4 px-4 py-4",
        ].join(" ")}
      >
        {isMobile ? null : (
          <aside className="sticky top-4 h-[calc(100vh-2rem)] w-[280px] shrink-0">
            <Card className="h-full rounded-[30px] border border-slate-200/80 bg-white/95 shadow-lg shadow-slate-200/70 backdrop-blur">
              <CardContent className="flex h-full flex-col gap-6 p-5">
                <div className="rounded-[26px] bg-[radial-gradient(circle_at_top,_#1e293b,_#0f172a_65%)] px-5 py-6 text-white shadow-inner">
                  <div className="text-3xl font-semibold tracking-tight">Linux.do</div>
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
                          "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all duration-200",
                          active
                            ? "bg-slate-900 text-white shadow-sm shadow-slate-300"
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
