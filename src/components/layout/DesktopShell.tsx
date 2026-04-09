import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { Button, Card, CardContent, Chip } from "@mui/material";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { hasLinuxDoSession, logoutLinuxDo, openLinuxDoLogin } from "../../api/linuxdo";
import { notifySessionChanged, SESSION_EVENT } from "../../utils/session";

type LoginStatusPayload = {
  url: string;
  logged_in: boolean;
};

export function DesktopShell() {
  const location = useLocation();
  const [loggedIn, setLoggedIn] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [openingLogin, setOpeningLogin] = useState(false);

  useEffect(() => {
    const check = async () => {
      setCheckingSession(true);
      try {
        setLoggedIn(await hasLinuxDoSession());
      } catch {
        setLoggedIn(false);
      } finally {
        setCheckingSession(false);
      }
    };

    const handleSessionChange = () => {
      void check();
    };

    let unlistenLoginStatus: (() => void) | undefined;

    void check();
    window.addEventListener(SESSION_EVENT, handleSessionChange);
    void listen<LoginStatusPayload>("linuxdo-login-status", async (event) => {
      if (event.payload.logged_in) {
        notifySessionChanged();
      }
      setOpeningLogin(false);
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
      notifySessionChanged();
    } catch (error) {
      console.error(error);
    } finally {
      setLoggingOut(false);
    }
  };

  const navItems = [
    { to: "/topics", label: "文章" },
    { to: "/messages", label: "消息" },
    { to: "/notifications", label: "通知" },
    { to: "/settings", label: "设置" },
  ];

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-[1600px] gap-6">
        <aside className="w-64 shrink-0">
          <Card className="h-full rounded-[28px] border border-slate-200 shadow-lg shadow-slate-200/70">
            <CardContent className="flex h-full flex-col gap-6 p-6">
              <div className="space-y-1">
                <div className="text-sm font-medium text-slate-500">Linux.do Desktop</div>
                <div className="text-2xl font-semibold text-slate-900">工作台</div>
              </div>

              <nav className="space-y-2">
                {navItems.map((item) => {
                  const active = location.pathname === item.to;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={[
                        "flex items-center rounded-2xl px-4 py-3 text-sm font-medium transition",
                        active
                          ? "bg-slate-900 text-white"
                          : "bg-slate-50 text-slate-700 hover:bg-slate-200",
                      ].join(" ")}
                    >
                      {item.label}
                    </NavLink>
                  );
                })}
              </nav>

              <div className="mt-auto rounded-3xl bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium text-slate-700">当前状态</div>
                    <div className="mt-1 text-sm text-slate-500">
                      {loggedIn ? "已检测到登录会话" : "游客模式"}
                    </div>
                  </div>
                  <Chip
                    label={loggedIn ? "已登录" : "未登录"}
                    color={loggedIn ? "success" : "default"}
                    size="small"
                  />
                </div>

                {loggedIn ? (
                  <Button
                    fullWidth
                    variant="outlined"
                    className="mt-4 h-10 rounded-2xl"
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
                    className="mt-4 h-10 rounded-2xl"
                    onClick={() => {
                      void handleLogin();
                    }}
                    disabled={checkingSession || openingLogin}
                  >
                    {openingLogin ? "打开登录中..." : "登录"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>

        <section className="min-w-0 flex-1">
          <Outlet />
        </section>
      </div>
    </main>
  );
}
