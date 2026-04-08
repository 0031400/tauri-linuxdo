import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  TextField,
} from "@mui/material";
import { fetch } from "@tauri-apps/plugin-http";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import {
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

type TopicPoster = {
  user_id?: number;
};

type TopicTag =
  | string
  | {
      id?: number;
      name?: string;
      slug?: string;
    };

type TopicItem = {
  id: number;
  title?: string;
  fancy_title?: string;
  slug?: string;
  posts_count?: number;
  views?: number;
  like_count?: number;
  created_at?: string;
  last_posted_at?: string;
  tags?: TopicTag[];
  posters?: TopicPoster[];
  excerpt?: string;
};

type TopicUser = {
  id: number;
  username: string;
  name?: string;
  avatar_template?: string;
};

type LatestTopicsResponse = {
  users?: TopicUser[];
  topic_list?: {
    topics?: TopicItem[];
  };
};

const BASE_URL = "https://linux.do";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/topics" replace />} />
      <Route path="/topics" element={<DesktopShell />}>
        <Route index element={<TopicsPage />} />
      </Route>
      <Route path="/messages" element={<DesktopShell />}>
        <Route index element={<PlaceholderPage title="消息" />} />
      </Route>
      <Route path="/notifications" element={<DesktopShell />}>
        <Route index element={<PlaceholderPage title="通知" />} />
      </Route>
      <Route path="/settings" element={<DesktopShell />}>
        <Route index element={<PlaceholderPage title="设置" />} />
      </Route>
      <Route path="*" element={<Navigate to="/topics" replace />} />
    </Routes>
  );
}

function DesktopShell() {
  const location = useLocation();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    const check = async () => {
      try {
        const cookieHeader = await invoke<string | null>("get_linuxdo_cookie_header");
        setLoggedIn(Boolean(cookieHeader && cookieHeader.trim()));
      } catch {
        setLoggedIn(false);
      }
    };

    void check();
  }, []);

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
                    <div className="mt-1 text-sm text-slate-500">{loggedIn ? "已检测到登录会话" : "游客模式"}</div>
                  </div>
                  <Chip label={loggedIn ? "已登录" : "未登录"} color={loggedIn ? "success" : "default"} size="small" />
                </div>
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

function TopicsPage() {
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [users, setUsers] = useState<Record<number, TopicUser>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");

      try {
        const cookieHeader = await invoke<string | null>("get_linuxdo_cookie_header");

        if (!cookieHeader || !cookieHeader.trim()) {
          setTopics([]);
          setUsers({});
          setSelectedId(null);
          setError("请先登录后再加载文章列表");
          return;
        }

        const response = await fetch(`${BASE_URL}/latest.json`, {
          method: "GET",
          headers: {
            Cookie: cookieHeader,
            Referer: `${BASE_URL}/`,
            Origin: BASE_URL,
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = (await response.json()) as LatestTopicsResponse;
        const nextTopics = data.topic_list?.topics ?? [];
        const nextUsers = Object.fromEntries(
          (data.users ?? []).map((user) => [user.id, user]),
        );

        setTopics(nextTopics);
        setUsers(nextUsers);
        setSelectedId(nextTopics[0]?.id ?? null);
      } catch (err) {
        console.error(err);
        setError("文章列表加载失败");
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const filteredTopics = useMemo(() => {
    const value = keyword.trim().toLowerCase();
    if (!value) return topics;

    return topics.filter((topic) => {
      const title = getTopicTitle(topic).toLowerCase();
      const tags = (topic.tags ?? []).map(getTopicTagLabel).join(" ").toLowerCase();
      return title.includes(value) || tags.includes(value);
    });
  }, [keyword, topics]);

  const selectedTopic =
    filteredTopics.find((topic) => topic.id === selectedId) ?? filteredTopics[0] ?? null;

  const selectedAuthor = selectedTopic ? getTopicAuthor(selectedTopic, users) : null;
  const selectedTopicUrl = selectedTopic ? getTopicUrl(selectedTopic) : null;

  return (
    <div className="grid h-full min-h-[calc(100vh-3rem)] grid-cols-[460px_minmax(0,1fr)] gap-6">
      <Card className="rounded-[28px] border border-slate-200 shadow-lg shadow-slate-200/70">
        <CardContent className="flex h-full flex-col gap-5 p-6">
          <div className="space-y-1">
            <div className="text-sm font-medium text-slate-500">文章中心</div>
            <div className="text-2xl font-semibold text-slate-900">最新文章</div>
          </div>

          <TextField
            fullWidth
            size="small"
            placeholder="搜索文章标题或标签"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />

          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-500">共 {filteredTopics.length} 篇</div>
            <Button variant="outlined" className="h-9 rounded-2xl" onClick={() => window.location.reload()}>
              刷新
            </Button>
          </div>

          <Divider />

          {loading ? (
            <div className="flex flex-1 items-center justify-center">
              <CircularProgress size={28} />
            </div>
          ) : error ? (
            <Alert severity="error">{error}</Alert>
          ) : (
            <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1">
              {filteredTopics.map((topic) => {
                const active = selectedTopic?.id === topic.id;
                const author = getTopicAuthor(topic, users);

                return (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => setSelectedId(topic.id)}
                    className={[
                      "w-full rounded-3xl border p-4 text-left transition",
                      active
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar
                        src={author?.avatar_template ? buildAvatarUrl(author.avatar_template, 96) : undefined}
                        className={active ? "bg-white text-slate-900" : "bg-slate-900 text-white"}
                      >
                        {author?.username?.slice(0, 1)?.toUpperCase() ?? "L"}
                      </Avatar>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3">
                          <div className="truncate text-sm font-medium">
                            {author?.name || author?.username || "linux.do"}
                          </div>
                          <div className={active ? "text-xs text-slate-300" : "text-xs text-slate-400"}>
                            {formatRelativeTime(topic.last_posted_at || topic.created_at)}
                          </div>
                        </div>

                        <div className="mt-1 line-clamp-2 text-base font-semibold">
                          {getTopicTitle(topic)}
                        </div>

                        <div className={["mt-2 line-clamp-2 text-sm", active ? "text-slate-300" : "text-slate-500"].join(" ")}>
                          {topic.excerpt || "打开右侧可查看文章详情与基本统计。"}
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {(topic.tags ?? []).slice(0, 3).map((tag) => (
                            <span
                              key={getTopicTagKey(tag)}
                              className={[
                                "rounded-full px-2.5 py-1 text-xs",
                                active ? "bg-white/10 text-slate-200" : "bg-slate-100 text-slate-600",
                              ].join(" ")}
                            >
                              #{getTopicTagLabel(tag)}
                            </span>
                          ))}

                          <span className={[
                            "ml-auto text-xs",
                            active ? "text-slate-300" : "text-slate-400",
                          ].join(" ")}>
                            {topic.posts_count ?? 0} 回复 · {topic.views ?? 0} 浏览
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="rounded-[28px] border border-slate-200 shadow-lg shadow-slate-200/70">
        <CardContent className="flex h-full flex-col p-8">
          {selectedTopic ? (
            <div className="flex h-full flex-col">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="text-sm font-medium text-slate-500">
                    {selectedAuthor?.name || selectedAuthor?.username || "linux.do"}
                  </div>
                  <h2 className="text-3xl font-semibold text-slate-900">{getTopicTitle(selectedTopic)}</h2>
                </div>
                <Chip label={`${selectedTopic.posts_count ?? 0} 回复`} color="primary" />
              </div>

              <Divider className="my-6" />

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">浏览</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{selectedTopic.views ?? 0}</div>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">点赞</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{selectedTopic.like_count ?? 0}</div>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">创建时间</div>
                  <div className="mt-2 text-base font-semibold text-slate-900">{formatAbsoluteTime(selectedTopic.created_at)}</div>
                </div>
              </div>

              <div className="mt-6 space-y-4 text-[15px] leading-7 text-slate-600">
                <p>{selectedTopic.excerpt || "该接口返回的 latest 列表里没有更完整正文时，这里先展示列表摘要。"}</p>
                <p>如果你下一步要继续做详情页，可以再接 <code>/t/:topicId.json</code> 把正文和回复流接进来。</p>
              </div>

              {(selectedTopic.tags ?? []).length > 0 ? (
                <div className="mt-6 flex flex-wrap gap-2">
                  {(selectedTopic.tags ?? []).map((tag) => (
                    <span key={getTopicTagKey(tag)} className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-600">
                      #{getTopicTagLabel(tag)}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-auto flex gap-3 pt-8">
                <Button
                  variant="contained"
                  className="h-11 rounded-2xl"
                  onClick={() => {
                    if (selectedTopicUrl) {
                      void openUrl(selectedTopicUrl);
                    }
                  }}
                >
                  打开原文
                </Button>
                <Button
                  variant="outlined"
                  className="h-11 rounded-2xl"
                  onClick={() => {
                    if (selectedTopic?.id) {
                      window.location.hash = `#/topics?topic=${selectedTopic.id}`;
                    }
                  }}
                >
                  保持选中
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500">暂无文章</div>
          )}
        </CardContent>
      </Card>
    </div>
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

function getTopicTitle(topic: TopicItem) {
  return stripHtml(topic.fancy_title || topic.title || `Topic #${topic.id}`);
}

function getTopicUrl(topic: TopicItem) {
  if (!topic.slug) {
    return `${BASE_URL}/t/${topic.id}`;
  }
  return `${BASE_URL}/t/${topic.slug}/${topic.id}`;
}

function getTopicAuthor(topic: TopicItem, users: Record<number, TopicUser>) {
  const userId = topic.posters?.[0]?.user_id;
  if (!userId) return null;
  return users[userId] ?? null;
}

function getTopicTagLabel(tag: TopicTag) {
  if (typeof tag === "string") {
    return tag;
  }

  return tag.name || tag.slug || String(tag.id ?? "");
}

function getTopicTagKey(tag: TopicTag) {
  if (typeof tag === "string") {
    return tag;
  }

  return tag.slug || tag.name || String(tag.id ?? "");
}

function buildAvatarUrl(template: string, size: number) {
  const resolved = template.replace(/\{size\}/g, String(size));
  if (resolved.startsWith("http://") || resolved.startsWith("https://")) {
    return resolved;
  }
  if (resolved.startsWith("//")) {
    return `https:${resolved}`;
  }
  return `${BASE_URL}${resolved}`;
}

function stripHtml(input: string) {
  return input.replace(/<[^>]+>/g, "").trim();
}

function formatRelativeTime(value?: string) {
  if (!value) return "未知";
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < hour) {
    return `${Math.max(1, Math.floor(diff / minute))} 分钟前`;
  }
  if (diff < day) {
    return `${Math.floor(diff / hour)} 小时前`;
  }
  if (diff < day * 7) {
    return `${Math.floor(diff / day)} 天前`;
  }

  return date.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
}

function formatAbsoluteTime(value?: string) {
  if (!value) return "未知";
  const date = new Date(value);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default App;






