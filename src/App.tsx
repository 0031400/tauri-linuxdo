import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  Chip,
  Divider,
  LinearProgress,
} from "@mui/material";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { fetch } from "@tauri-apps/plugin-http";

type LoginStatusPayload = {
  url: string;
  logged_in: boolean;
};

type SessionState = {
  loggedIn: boolean;
  cookieHeader: string | null;
};

const LINUX_DO_BASE_URL = "https://linux.do";

function App() {
  const [opening, setOpening] = useState(false);
  const [checkingSession, setCheckingSession] = useState(false);
  const [currentUrl, setCurrentUrl] = useState("");
  const [message, setMessage] = useState("未登录");
  const [session, setSession] = useState<SessionState>({
    loggedIn: false,
    cookieHeader: null,
  });

  useEffect(() => {
    let unlisten: undefined | (() => void);

    const setup = async () => {
      unlisten = await listen<LoginStatusPayload>("linuxdo-login-status", (event) => {
        setCurrentUrl(event.payload.url);

        if (event.payload.logged_in) {
          setOpening(false);
          setMessage("已检测到登录完成，正在同步会话");
          void refreshSession();
        } else {
          setMessage("登录窗口已打开");
        }
      });
    };

    void setup();
    void refreshSession();

    return () => {
      unlisten?.();
    };
  }, []);

  const refreshSession = async () => {
    try {
      setCheckingSession(true);
      const cookieHeader = await invoke<string | null>("get_linuxdo_cookie_header");

      if (cookieHeader && cookieHeader.trim()) {
        setSession({
          loggedIn: true,
          cookieHeader,
        });
        setMessage("已登录");
      } else {
        setSession({
          loggedIn: false,
          cookieHeader: null,
        });
        setMessage("未检测到登录会话");
      }
    } catch (error) {
      console.error(error);
      setMessage("读取登录会话失败");
    } finally {
      setCheckingSession(false);
    }
  };

  const handleOpenLogin = async () => {
    try {
      setOpening(true);
      setMessage("正在打开登录窗口");
      await invoke("open_login_webview");
    } catch (error) {
      console.error(error);
      setOpening(false);
      setMessage("打开登录窗口失败");
    }
  };

  const handleTestRequest = async () => {
    if (!session.cookieHeader) {
      setMessage("当前没有可用会话");
      return;
    }

    try {
      const response = await fetch(`${LINUX_DO_BASE_URL}/session/current.json`, {
        method: "GET",
        headers: {
          Cookie: session.cookieHeader,
          Referer: `${LINUX_DO_BASE_URL}/`,
          Origin: LINUX_DO_BASE_URL,
        },
      });

      const text = await response.text();
      console.log("session/current.json", response.status, text);
      setMessage(`测试请求完成，状态码 ${response.status}`);
    } catch (error) {
      console.error(error);
      setMessage("测试请求失败");
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center justify-center">
        <Card className="w-full rounded-[28px] border border-slate-200 shadow-xl shadow-slate-200/80">
          <CardContent className="p-8 sm:p-10">
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="text-sm font-medium text-slate-500">Linux.do Desktop</div>
                <h1 className="text-3xl font-semibold text-slate-900">登录</h1>
              </div>

              <Alert severity={session.loggedIn ? "success" : "info"}>
                {message}
              </Alert>

              {(opening || checkingSession) && <LinearProgress />}

              <div className="rounded-3xl bg-slate-50 p-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-medium text-slate-700">当前状态</div>
                  <Chip
                    label={session.loggedIn ? "已登录" : "未登录"}
                    color={session.loggedIn ? "success" : "default"}
                    size="small"
                  />
                </div>

                <Divider className="my-4" />

                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Last URL
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                      {currentUrl || "尚未打开登录窗口"}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-400">
                      Cookie Header
                    </div>
                    <div className="max-h-32 overflow-auto rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600">
                      {session.cookieHeader || "暂无"}
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleOpenLogin}
                  disabled={opening}
                  className="h-12 rounded-2xl"
                >
                  打开 Linux.do 登录窗口
                </Button>

                <Button
                  variant="outlined"
                  fullWidth
                  onClick={refreshSession}
                  disabled={checkingSession}
                  className="h-12 rounded-2xl"
                >
                  读取当前登录会话
                </Button>

                <Button
                  variant="outlined"
                  fullWidth
                  onClick={handleTestRequest}
                  disabled={!session.cookieHeader}
                  className="h-12 rounded-2xl"
                >
                  测试已登录请求
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default App;
