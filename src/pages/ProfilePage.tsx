import { Alert, Button, Card, CardContent, CircularProgress } from "@mui/material";
import { useEffect, useState } from "react";
import {
  clearTopicCategoriesCache,
  hasLinuxDoSession,
  hydrateLinuxDoCookieHeader,
  logoutLinuxDo,
  openLinuxDoLogin,
  setLinuxDoCookieHeader,
  takePendingLinuxDoLoginCookie,
} from "../api/linuxdo";
import { getPlatformCapabilities } from "../utils/platform";
import { logLinuxDoCookieError, logReceivedLinuxDoCookie } from "../utils/logger";
import { notifySessionChanged, SESSION_EVENT } from "../utils/session";

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
        await hydrateLinuxDoCookieHeader();
        const pendingCookieHeader = await takePendingLinuxDoLoginCookie();
        if (typeof pendingCookieHeader === "string" && pendingCookieHeader.trim()) {
          await logReceivedLinuxDoCookie(pendingCookieHeader, "profile bootstrap");
          await setLinuxDoCookieHeader(pendingCookieHeader);
        }
        await refreshSession();
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
          const pendingCookieHeader = await takePendingLinuxDoLoginCookie();
          if (typeof pendingCookieHeader === "string" && pendingCookieHeader.trim()) {
            await logReceivedLinuxDoCookie(pendingCookieHeader, "profile focus");
            await setLinuxDoCookieHeader(pendingCookieHeader);
          }
        } catch (error) {
          console.error(error);
          await logLinuxDoCookieError("failed to read pending cookie on profile focus", error);
        }
        await refreshSession();
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
      clearTopicCategoriesCache();
      notifySessionChanged();
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
      <Card className="rounded-2xl border border-slate-200 shadow-sm">
        <CardContent className={isMobile ? "space-y-4 p-4" : "space-y-5 p-6"}>
          <div>
            <div className="text-lg font-semibold">Profile</div>
            <div className="text-sm text-slate-500">Manage linux.do login status here.</div>
          </div>

          {initializing ? (
            <div className="flex h-28 items-center justify-center">
              <CircularProgress size={24} />
            </div>
          ) : (
            <>
              <Alert severity={loggedIn ? "success" : "info"}>
                {loggedIn ? "Current status: Logged in" : "Current status: Not logged in"}
              </Alert>
              {actionError ? <Alert severity="error">{actionError}</Alert> : null}
              <Button
                fullWidth
                variant="contained"
                onClick={() => {
                  void handleLogin();
                }}
                disabled={checkingSession || openingLogin || clearingCookie}
              >
                {openingLogin ? "Opening login..." : "Login"}
              </Button>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => {
                  void handleClearCookie();
                }}
                disabled={checkingSession || openingLogin || clearingCookie}
              >
                {clearingCookie ? "Clearing cookie..." : "Clear linux.do Cookie"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
