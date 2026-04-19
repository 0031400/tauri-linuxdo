import { Alert, Button, Card, CardContent, CircularProgress } from "@mui/material";
import { useEffect, useState } from "react";
import {
  hasLinuxDoSession,
  logoutLinuxDo,
  openLinuxDoLogin,
  syncLinuxDoSession,
} from "../api/linuxdo";
import { getPlatformCapabilities } from "../utils/platform";
import { logLinuxDoCookieError } from "../utils/logger";
import { SESSION_EVENT } from "../utils/session";

export function ProfilePage() {
  const { isMobile } = getPlatformCapabilities();
  const [initializing, setInitializing] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [checkingSession, setCheckingSession] = useState(false);
  const [openingLogin, setOpeningLogin] = useState(false);
  const [clearingCookie, setClearingCookie] = useState(false);
  const [actionError, setActionError] = useState("");

  useEffect(() => {
    const refreshSession = async () => {
      setCheckingSession(true);
      try {
        const hasSession = await hasLinuxDoSession();
        setLoggedIn(hasSession);
      } catch {
        setLoggedIn(false);
      } finally {
        setCheckingSession(false);
      }
    };

    const bootstrap = async () => {
      try {
        const session = await syncLinuxDoSession("profile bootstrap");
        setLoggedIn(session.loggedIn);
      } finally {
        setOpeningLogin(false);
        setInitializing(false);
      }
    };

    const handleSessionChange = () => {
      void refreshSession();
    };

    const handleAppFocus = () => {
      void (async () => {
        try {
          const session = await syncLinuxDoSession("profile focus");
          setLoggedIn(session.loggedIn);
        } catch (error) {
          console.error(error);
          await logLinuxDoCookieError("failed to read pending cookie on profile focus", error);
        }
      })();
    };

    void bootstrap();
    window.addEventListener(SESSION_EVENT, handleSessionChange);
    window.addEventListener("focus", handleAppFocus);

    return () => {
      window.removeEventListener(SESSION_EVENT, handleSessionChange);
      window.removeEventListener("focus", handleAppFocus);
    };
  }, []);

  const handleLogin = async () => {
    setActionError("");
    setOpeningLogin(true);
    try {
      await openLinuxDoLogin();
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : "Failed to open linux.do login page.");
      setOpeningLogin(false);
    }
  };

  const handleClearCookie = async () => {
    setActionError("");
    setClearingCookie(true);
    try {
      await logoutLinuxDo();
      setLoggedIn(false);
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : "Failed to clear linux.do cookie.");
    } finally {
      setClearingCookie(false);
    }
  };

  return (
    <div className={isMobile ? "min-h-[calc(100vh-6rem)]" : "mx-auto max-w-[760px] py-6"}>
      <Card className="rounded-[28px] border border-slate-200/80 bg-white/95 shadow-lg shadow-slate-200/70">
        <CardContent className={isMobile ? "space-y-4 p-4" : "space-y-5 p-6"}>
          <div className="flex items-center justify-between gap-3">
            <div className="text-xl font-semibold tracking-tight text-slate-900">Profile</div>
            <div
              className={[
                "rounded-full px-3 py-1 text-xs font-medium",
                loggedIn ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500",
              ].join(" ")}
            >
              {loggedIn ? "Connected" : "Disconnected"}
            </div>
          </div>

          {initializing ? (
            <div className="flex h-28 items-center justify-center">
              <CircularProgress size={24} />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Alert severity={loggedIn ? "success" : "info"}>{loggedIn ? "已登录" : "未登录"}</Alert>
              {actionError ? <Alert severity="error">{actionError}</Alert> : null}
              <Button
                fullWidth
                variant="contained"
                className="h-11 rounded-xl"
                onClick={() => {
                  void handleLogin();
                }}
                disabled={checkingSession || openingLogin || clearingCookie}
              >
                {openingLogin ? "logging in..." : "login"}
              </Button>
              <Button
                fullWidth
                variant="outlined"
                className="h-11 rounded-xl"
                onClick={() => {
                  void handleClearCookie();
                }}
                disabled={checkingSession || openingLogin || clearingCookie}
              >
                {clearingCookie ? "logging out..." : "logout"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
