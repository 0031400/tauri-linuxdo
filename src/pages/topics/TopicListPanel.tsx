import { Alert, Avatar, Button, Card, CardContent, CircularProgress, TextField } from "@mui/material";
import type { UIEvent } from "react";
import type { TopicItem, TopicUser } from "../../types/topic";
import { useAvatarSrc } from "../../hooks/useAvatarSrc";
import {
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

type TopicAuthorAvatarProps = {
  avatarTemplate?: string;
  fallback: string;
  active: boolean;
};

function TopicAuthorAvatar({ avatarTemplate, fallback, active }: TopicAuthorAvatarProps) {
  const avatarSrc = useAvatarSrc(avatarTemplate, 96);

  return (
    <Avatar src={avatarSrc} className={active ? "bg-white text-slate-900" : "bg-slate-900 text-white"}>
      {fallback}
    </Avatar>
  );
}

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
    <Card className="h-full overflow-hidden rounded-2xl border border-slate-200 shadow-md shadow-slate-200/60">
      <CardContent className="flex h-full min-h-0 flex-col gap-3 p-4">
        <div className="flex items-center gap-2">
          <TextField
            fullWidth
            size="small"
            placeholder="Search title or tag"
            value={keyword}
            onChange={(event) => onKeywordChange(event.target.value)}
          />
          <Button variant="outlined" className="h-10 shrink-0 rounded-xl px-4" onClick={onRefresh}>
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center">
            <CircularProgress size={28} />
          </div>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <div className="min-h-0 flex-1 space-y-2 overflow-auto pr-1" onScroll={handleListScroll}>
            {filteredTopics.map((topic) => {
              const active = selectedTopic?.id === topic.id;
              const author = getTopicAuthor(topic, users);

              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => onSelectTopic(topic.id)}
                  className={[
                    "w-full rounded-2xl border p-3 text-left transition",
                    active
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-2.5">
                    <TopicAuthorAvatar
                      avatarTemplate={author?.avatar_template}
                      fallback={author?.username?.slice(0, 1)?.toUpperCase() ?? "L"}
                      active={active}
                    />

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate text-sm font-medium">
                          {author?.name || author?.username || "linux.do"}
                        </div>
                        <div className={active ? "text-xs text-slate-300" : "text-xs text-slate-400"}>
                          {formatRelativeTime(topic.last_posted_at || topic.created_at)}
                        </div>
                      </div>

                      <div className="mt-1 line-clamp-2 text-[15px] font-semibold">{getTopicTitle(topic)}</div>

                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {(topic.tags ?? []).slice(0, 3).map((tag) => (
                          <span
                            key={getTopicTagKey(tag)}
                            className={[
                              "rounded-full px-2 py-0.5 text-xs",
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
