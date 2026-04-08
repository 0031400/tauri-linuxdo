import { useMemo, useState } from "react";
import {
  Avatar,
  Button,
  Card,
  CardContent,
  Chip,
  Alert,
  Divider,
  TextField,
} from "@mui/material";
import {
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

type MessageItem = {
  id: number;
  author: string;
  avatar: string;
  title: string;
  preview: string;
  time: string;
  unread: boolean;
  tags: string[];
};

const messages: MessageItem[] = [
  {
    id: 1,
    author: "Linux.do 系统",
    avatar: "系",
    title: "欢迎使用桌面端",
    preview: "你的桌面端已经准备完成，可以开始浏览话题、通知和私信。",
    time: "09:24",
    unread: true,
    tags: ["系统"],
  },
  {
    id: 2,
    author: "通知中心",
    avatar: "通",
    title: "你有新的回复",
    preview: "你关注的话题里有人回复了你，点进来查看完整内容。",
    time: "昨天",
    unread: true,
    tags: ["回复"],
  },
  {
    id: 3,
    author: "站务组",
    avatar: "站",
    title: "社区规则更新",
    preview: "请留意新版社区发帖规范，部分分类的发布要求已有调整。",
    time: "周一",
    unread: false,
    tags: ["公告"],
  },
  {
    id: 4,
    author: "私信",
    avatar: "私",
    title: "关于你的反馈",
    preview: "我们已经收到你的建议，正在整理桌面端后续迭代方向。",
    time: "04-06",
    unread: false,
    tags: ["私信"],
  },
];

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/messages" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/app" element={<Navigate to="/messages" replace />} />
      <Route path="/messages" element={<DesktopShell />}>
        <Route index element={<MessagesPage />} />
      </Route>
      <Route path="/topics" element={<DesktopShell />}>
        <Route index element={<PlaceholderPage title="话题" />} />
      </Route>
      <Route path="/notifications" element={<DesktopShell />}>
        <Route index element={<PlaceholderPage title="通知" />} />
      </Route>
      <Route path="/settings" element={<DesktopShell />}>
        <Route index element={<PlaceholderPage title="设置" />} />
      </Route>
      <Route path="*" element={<Navigate to="/messages" replace />} />
    </Routes>
  );
}

function DesktopShell() {
  const location = useLocation();

  const navItems = [
    { to: "/messages", label: "消息" },
    { to: "/topics", label: "话题" },
    { to: "/notifications", label: "通知" },
    { to: "/settings", label: "设置" },
  ];

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] mmax-w-400 gap-6">
        <aside className="w-64 shrink-0">
          <Card className="h-full rounded-[28px] border border-slate-200 shadow-lg shadow-slate-200/70">
            <CardContent className="flex h-full flex-col gap-6 p-6">
              <div className="space-y-1">
                <div className="text-sm font-medium text-slate-500">
                  Linux.do Desktop
                </div>
                <div className="text-2xl font-semibold text-slate-900">
                  工作台
                </div>
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
                <div className="text-sm font-medium text-slate-700">
                  当前平台
                </div>
                <div className="mt-2 text-sm text-slate-500">
                  Windows 横向布局
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>

        <section className="min-w-0 flex-1">
          <Routes>
            <Route index element={<MessagesPage />} />
          </Routes>
        </section>
      </div>
    </main>
  );
}

function MessagesPage() {
  const [keyword, setKeyword] = useState("");
  const [selectedId, setSelectedId] = useState<number>(messages[0]?.id ?? 0);

  const filteredMessages = useMemo(() => {
    const value = keyword.trim().toLowerCase();
    if (!value) return messages;
    return messages.filter((item) => {
      return (
        item.author.toLowerCase().includes(value) ||
        item.title.toLowerCase().includes(value) ||
        item.preview.toLowerCase().includes(value)
      );
    });
  }, [keyword]);

  const selectedMessage =
    filteredMessages.find((item) => item.id === selectedId) ??
    filteredMessages[0] ??
    null;

  return (
    <div className="grid h-full min-h-[calc(100vh-3rem)] grid-cols-[420px_minmax(0,1fr)] gap-6">
      <Card className="rounded-[28px] border border-slate-200 shadow-lg shadow-slate-200/70">
        <CardContent className="flex h-full flex-col gap-5 p-6">
          <div className="space-y-1">
            <div className="text-sm font-medium text-slate-500">消息中心</div>
            <div className="text-2xl font-semibold text-slate-900">
              消息列表
            </div>
          </div>

          <TextField
            fullWidth
            size="small"
            placeholder="搜索消息"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />

          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-500">
              共 {filteredMessages.length} 条
            </div>
            <Chip
              label={`${filteredMessages.filter((item) => item.unread).length} 未读`}
              color="primary"
              size="small"
            />
          </div>

          <Divider />

          <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
            {filteredMessages.map((item) => {
              const active = selectedMessage?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={[
                    "w-full rounded-3xl border p-4 text-left transition",
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-3">
                    <Avatar
                      className={
                        active
                          ? "bg-white text-slate-900"
                          : "bg-slate-900 text-white"
                      }
                    >
                      {item.avatar}
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate text-sm font-medium">
                          {item.author}
                        </div>
                        <div
                          className={
                            active
                              ? "text-xs text-slate-300"
                              : "text-xs text-slate-400"
                          }
                        >
                          {item.time}
                        </div>
                      </div>

                      <div className="mt-1 truncate text-base font-semibold">
                        {item.title}
                      </div>

                      <div
                        className={[
                          "mt-2 line-clamp-2 text-sm",
                          active ? "text-slate-300" : "text-slate-500",
                        ].join(" ")}
                      >
                        {item.preview}
                      </div>

                      <div className="mt-3 flex items-center gap-2">
                        {item.tags.map((tag) => (
                          <span
                            key={tag}
                            className={[
                              "rounded-full px-2.5 py-1 text-xs",
                              active
                                ? "bg-white/10 text-slate-200"
                                : "bg-slate-100 text-slate-600",
                            ].join(" ")}
                          >
                            {tag}
                          </span>
                        ))}
                        {item.unread ? (
                          <span
                            className={[
                              "ml-auto h-2.5 w-2.5 rounded-full",
                              active ? "bg-emerald-400" : "bg-sky-500",
                            ].join(" ")}
                          />
                        ) : null}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-[28px] border border-slate-200 shadow-lg shadow-slate-200/70">
        <CardContent className="flex h-full flex-col p-8">
          {selectedMessage ? (
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-slate-500">
                    {selectedMessage.author}
                  </div>
                  <h2 className="text-3xl font-semibold text-slate-900">
                    {selectedMessage.title}
                  </h2>
                </div>
                <Chip
                  label={selectedMessage.unread ? "未读" : "已读"}
                  color={selectedMessage.unread ? "primary" : "default"}
                />
              </div>

              <Divider className="my-6" />

              <div className="space-y-4 text-[15px] leading-7 text-slate-600">
                <p>{selectedMessage.preview}</p>
                <p>
                  这里先把右侧详情面板搭起来，后续你接 Linux.do
                  的通知、私信或消息 API 时，直接把详情内容替换成真实数据即可。
                </p>
                <p>
                  当前布局已经适合 Windows
                  横向窗口，后面只需要继续往消息模型里填字段。
                </p>
              </div>

              <div className="mt-auto flex gap-3 pt-8">
                <Button variant="contained" className="h-11 rounded-2xl">
                  标记已读
                </Button>
                <Button variant="outlined" className="h-11 rounded-2xl">
                  打开原始链接
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500">
              暂无消息
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center justify-center">
        <Card className="w-full rounded-[28px] border border-slate-200 shadow-lg shadow-slate-200/70">
          <CardContent className="space-y-6 p-8 sm:p-10">
            <div className="space-y-2">
              <div className="text-sm font-medium text-slate-500">
                Linux.do Desktop
              </div>
              <h1 className="text-3xl font-semibold text-slate-900">登录</h1>
            </div>

            <Alert severity="info">
              这里保留登录入口，后续接你的 WebView 登录逻辑。
            </Alert>

            <Button
              href="#/messages"
              variant="contained"
              fullWidth
              className="h-12 rounded-2xl"
            >
              进入消息页
            </Button>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="flex h-full min-h-[calc(100vh-3rem)] items-center justify-center">
      <Card className="w-full rounded-[28px] border border-slate-200 shadow-lg shadow-slate-200/70">
        <CardContent className="p-10">
          <div className="space-y-3">
            <div className="text-sm font-medium text-slate-500">占位页面</div>
            <div className="text-3xl font-semibold text-slate-900">{title}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default App;
