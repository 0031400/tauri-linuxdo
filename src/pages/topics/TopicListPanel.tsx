import { Alert, Avatar, Button, Card, CardContent, CircularProgress, Divider, TextField } from "@mui/material";
import type { UIEvent } from "react";
import type { TopicItem, TopicUser } from "../../types/topic";
import {
  buildAvatarUrl,
  formatRelativeTime,
  getTopicAuthor,
  getTopicTagKey,
  getTopicTagLabel,
  getTopicTitle,
} from "../../utils/topics";

type TopicListPanelProps = {
  filteredTopics: TopicItem[];
  selectedTopic: TopicItem | null;
  users: Record<number, TopicUser>;
  loading: boolean;
  error: string;
  keyword: string;
  onKeywordChange: (value: string) => void;
  onRefresh: () => void;
  onSelectTopic: (topicId: number) => void;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
};

export function TopicListPanel({
  filteredTopics,
  selectedTopic,
  users,
  loading,
  error,
  keyword,
  onKeywordChange,
  onRefresh,
  onSelectTopic,
  loadingMore,
  hasMore,
  onLoadMore,
}: TopicListPanelProps) {
  const handleListScroll = (event: UIEvent<HTMLDivElement>) => {
    if (loadingMore || !hasMore) return;

    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if (scrollHeight - (scrollTop + clientHeight) < 120) {
      onLoadMore();
    }
  };

  return (
    <Card className="h-full overflow-hidden rounded-[28px] border border-slate-200 shadow-lg shadow-slate-200/70">
      <CardContent className="flex h-full flex-col gap-5 p-6">
        <div className="space-y-1">
          <div className="text-sm font-medium text-slate-500">Topics</div>
          <div className="text-2xl font-semibold text-slate-900">Latest Posts</div>
        </div>

        <TextField
          fullWidth
          size="small"
          placeholder="Search title or tag"
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
        />

        <div className="flex items-center justify-between">
          <div className="text-sm text-slate-500">Total {filteredTopics.length}</div>
          <Button variant="outlined" className="h-9 rounded-2xl" onClick={onRefresh}>
            Refresh
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
          <div className="min-h-0 flex-1 space-y-3 overflow-auto pr-1" onScroll={handleListScroll}>
            {filteredTopics.map((topic) => {
              const active = selectedTopic?.id === topic.id;
              const author = getTopicAuthor(topic, users);

              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => onSelectTopic(topic.id)}
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

                      <div className="mt-1 line-clamp-2 text-base font-semibold">{getTopicTitle(topic)}</div>

                      <div
                        className={[
                          "mt-2 line-clamp-2 text-sm",
                          active ? "text-slate-300" : "text-slate-500",
                        ].join(" ")}
                      >
                        {topic.excerpt || "Open the right panel for full content and stats."}
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
                          className={["ml-auto text-xs", active ? "text-slate-300" : "text-slate-400"].join(" ")}
                        >
                          {topic.posts_count ?? 0} replies | {topic.views ?? 0} views
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
            {loadingMore ? (
              <div className="flex justify-center py-2">
                <CircularProgress size={22} />
              </div>
            ) : null}
            {!hasMore && filteredTopics.length > 0 ? (
              <div className="py-2 text-center text-xs text-slate-400">No more topics</div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
