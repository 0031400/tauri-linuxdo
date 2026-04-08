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
import { openUrl } from "@tauri-apps/plugin-opener";
import type { TopicItem, TopicUser } from "../types/topic";
import { fetchLatestTopics } from "../api/linuxdo";
import {
  buildAvatarUrl,
  formatAbsoluteTime,
  formatRelativeTime,
  getTopicAuthor,
  getTopicTagKey,
  getTopicTagLabel,
  getTopicTitle,
  getTopicUrl,
} from "../utils/topics";

export function TopicsPage() {
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
        const data = await fetchLatestTopics();
        const nextTopics = data.topic_list?.topics ?? [];
        const nextUsers = Object.fromEntries((data.users ?? []).map((user) => [user.id, user]));

        setTopics(nextTopics);
        setUsers(nextUsers);
        setSelectedId(nextTopics[0]?.id ?? null);
      } catch (err) {
        console.error(err);
        if (err instanceof Error && err.message === "AUTH_REQUIRED") {
          setError("请先登录后再加载文章列表");
        } else {
          setError("文章列表加载失败");
        }
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

                        <div
                          className={[
                            "mt-2 line-clamp-2 text-sm",
                            active ? "text-slate-300" : "text-slate-500",
                          ].join(" ")}
                        >
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

                          <span
                            className={[
                              "ml-auto text-xs",
                              active ? "text-slate-300" : "text-slate-400",
                            ].join(" ")}
                          >
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
                  <div className="mt-2 text-base font-semibold text-slate-900">
                    {formatAbsoluteTime(selectedTopic.created_at)}
                  </div>
                </div>
              </div>

              <div className="mt-6 space-y-4 text-[15px] leading-7 text-slate-600">
                <p>{selectedTopic.excerpt || "该接口返回的 latest 列表里没有更完整正文时，这里先展示列表摘要。"}</p>
                <p>
                  如果你下一步要继续做详情页，可以再接 <code>/t/:topicId.json</code> 把正文和回复流接进来。
                </p>
              </div>

              {(selectedTopic.tags ?? []).length > 0 ? (
                <div className="mt-6 flex flex-wrap gap-2">
                  {(selectedTopic.tags ?? []).map((tag) => (
                    <span
                      key={getTopicTagKey(tag)}
                      className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-600"
                    >
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
