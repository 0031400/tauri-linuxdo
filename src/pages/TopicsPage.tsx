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
import { fetchLatestTopics, fetchTopicDetail } from "../api/linuxdo";
import type { TopicDetailResponse, TopicItem, TopicPost, TopicUser } from "../types/topic";
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

function getPostLikeCount(post?: TopicPost) {
  return post?.actions_summary?.find((item) => item.id === 2)?.count ?? 0;
}

export function TopicsPage() {
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [users, setUsers] = useState<Record<number, TopicUser>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<TopicDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");

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
        setSelectedId((currentId) => currentId ?? nextTopics[0]?.id ?? null);
      } catch (err) {
        console.error(err);
        setTopics([]);
        setUsers({});
        setSelectedId(null);
        setDetail(null);
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

  useEffect(() => {
    if (!selectedTopic?.id) {
      setDetail(null);
      setDetailError("");
      setDetailLoading(false);
      return;
    }

    let cancelled = false;

    const loadDetail = async () => {
      setDetailLoading(true);
      setDetailError("");

      try {
        const data = await fetchTopicDetail(selectedTopic.id);
        if (!cancelled) {
          setDetail(data);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setDetail(null);
          setDetailError("文章详情加载失败");
        }
      } finally {
        if (!cancelled) {
          setDetailLoading(false);
        }
      }
    };

    void loadDetail();

    return () => {
      cancelled = true;
    };
  }, [selectedTopic?.id]);

  const selectedAuthor = selectedTopic ? getTopicAuthor(selectedTopic, users) : null;
  const selectedTopicUrl = selectedTopic ? getTopicUrl(selectedTopic) : null;
  const firstPost = detail?.post_stream?.posts?.[0] ?? null;
  const detailAuthor = detail?.details?.created_by ?? selectedAuthor;
  const detailLikeCount = detail?.like_count ?? getPostLikeCount(firstPost ?? undefined);

  return (
    <div className="grid h-[calc(100vh-3rem)] grid-cols-[460px_minmax(0,1fr)] gap-6">
      <Card className="h-full overflow-hidden rounded-[28px] border border-slate-200 shadow-lg shadow-slate-200/70">
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

      <Card className="h-full overflow-hidden rounded-[28px] border border-slate-200 shadow-lg shadow-slate-200/70">
        <CardContent className="flex h-full flex-col p-8">
          {selectedTopic ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="text-sm font-medium text-slate-500">
                    {detailAuthor?.name || detailAuthor?.username || "linux.do"}
                  </div>
                  <h2 className="text-3xl font-semibold text-slate-900">{getTopicTitle(selectedTopic)}</h2>
                </div>
                <Chip label={`${detail?.posts_count ?? selectedTopic.posts_count ?? 0} 回复`} color="primary" />
              </div>

              <Divider className="my-6" />

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-3xl bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">浏览</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">
                    {detail?.views ?? selectedTopic.views ?? 0}
                  </div>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">点赞</div>
                  <div className="mt-2 text-2xl font-semibold text-slate-900">{detailLikeCount}</div>
                </div>
                <div className="rounded-3xl bg-slate-50 p-4">
                  <div className="text-sm text-slate-500">创建时间</div>
                  <div className="mt-2 text-base font-semibold text-slate-900">
                    {formatAbsoluteTime(detail?.created_at || selectedTopic.created_at)}
                  </div>
                </div>
              </div>

              <div className="mt-6 min-h-0 flex-1 overflow-auto pr-2">
                {detailLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <CircularProgress size={28} />
                  </div>
                ) : detailError ? (
                  <Alert severity="error">{detailError}</Alert>
                ) : firstPost?.cooked ? (
                  <article
                    className="max-w-none text-[15px] leading-7 text-slate-700 [&_a]:text-sky-700 [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-slate-200 [&_blockquote]:pl-4 [&_img]:h-auto [&_img]:max-w-full [&_pre]:overflow-auto [&_pre]:rounded-2xl [&_pre]:bg-slate-950 [&_pre]:p-4 [&_pre]:text-slate-100"
                    dangerouslySetInnerHTML={{ __html: firstPost.cooked }}
                  />
                ) : (
                  <div className="space-y-4 text-[15px] leading-7 text-slate-600">
                    <p>{selectedTopic.excerpt || "该文章暂时没有可展示的正文内容。"}</p>
                    <p>详情接口已接通，但当前返回里没有拿到首帖正文。</p>
                  </div>
                )}
              </div>

              {(detail?.tags ?? selectedTopic.tags ?? []).length > 0 ? (
                <div className="mt-6 flex flex-wrap gap-2">
                  {(detail?.tags ?? selectedTopic.tags ?? []).map((tag) => (
                    <span
                      key={getTopicTagKey(tag)}
                      className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-600"
                    >
                      #{getTopicTagLabel(tag)}
                    </span>
                  ))}
                </div>
              ) : null}

              <div className="mt-6 flex items-center justify-between gap-3 border-t border-slate-100 pt-6">
                <div className="text-sm text-slate-500">
                  {firstPost?.updated_at
                    ? `最近更新于 ${formatAbsoluteTime(firstPost.updated_at)}`
                    : `创建于 ${formatAbsoluteTime(detail?.created_at || selectedTopic.created_at)}`}
                </div>
                <div className="flex gap-3">
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
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-slate-500">暂无文章</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
