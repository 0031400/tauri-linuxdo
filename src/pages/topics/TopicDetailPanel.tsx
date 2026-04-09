import type { ReactNode } from "react";
import { Alert, Avatar, Button, Card, CardContent, Chip, CircularProgress } from "@mui/material";
import type { UIEvent } from "react";
import type { TopicDetailResponse, TopicItem, TopicPost, TopicTag, TopicUser } from "../../types/topic";
import {
  buildAvatarUrl,
  formatAbsoluteTime,
  getTopicTagKey,
  getTopicTagLabel,
  getTopicTitle,
} from "../../utils/topics";

type TopicDetailPanelProps = {
  selectedTopic: TopicItem | null;
  detail: TopicDetailResponse | null;
  detailAuthor: TopicUser | null;
  detailLikeCount: number;
  detailLoading: boolean;
  detailError: string;
  posts: TopicPost[];
  renderPostContent: (post: TopicPost) => ReactNode[] | null;
  loadingMorePosts: boolean;
  hasMorePosts: boolean;
  onLoadMorePosts: () => void;
  onRetryDetail: () => void;
};

function getTags(detail: TopicDetailResponse | null, selectedTopic: TopicItem | null): TopicTag[] {
  return detail?.tags ?? selectedTopic?.tags ?? [];
}

export function TopicDetailPanel({
  selectedTopic,
  detail,
  detailAuthor,
  detailLikeCount,
  detailLoading,
  detailError,
  posts,
  renderPostContent,
  loadingMorePosts,
  hasMorePosts,
  onLoadMorePosts,
  onRetryDetail,
}: TopicDetailPanelProps) {
  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    if (loadingMorePosts || !hasMorePosts || detailLoading || detailError) return;
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    if (scrollHeight - (scrollTop + clientHeight) < 120) {
      onLoadMorePosts();
    }
  };

  if (!selectedTopic) {
    return (
      <Card className="h-full overflow-hidden rounded-2xl border border-slate-200 shadow-md shadow-slate-200/60">
        <CardContent className="flex h-full items-center justify-center text-slate-500">
          No topic selected
        </CardContent>
      </Card>
    );
  }

  const tags = getTags(detail, selectedTopic);

  return (
    <Card className="h-full overflow-hidden rounded-2xl border border-slate-200 shadow-md shadow-slate-200/60">
      <CardContent className="h-full overflow-auto p-4" onScroll={handleScroll}>
        <div className="flex min-h-full flex-col">
          <div className="rounded-xl bg-slate-50/70 px-3 py-2.5">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                {detailAuthor?.name || detailAuthor?.username || "linux.do"}
                </div>
                <h2 className="text-xl font-semibold text-slate-900">{getTopicTitle(selectedTopic)}</h2>
              </div>
              <Chip
                label={`${detail?.posts_count ?? selectedTopic.posts_count ?? 0} replies`}
                color="primary"
                size="small"
              />
            </div>

            <div className="mt-2 text-xs text-slate-500">
              {detail?.views ?? selectedTopic.views ?? 0} views | {detailLikeCount} likes | created{" "}
              {formatAbsoluteTime(detail?.created_at || selectedTopic.created_at)}
            </div>
          </div>

          <div className="mt-4 pr-1">
            {detailLoading ? (
              <div className="flex min-h-[220px] items-center justify-center">
                <CircularProgress size={28} />
              </div>
            ) : detailError ? (
              <Alert
                severity="error"
                action={
                  <Button color="inherit" size="small" onClick={onRetryDetail}>
                    Retry
                  </Button>
                }
              >
                {detailError}
              </Alert>
            ) : posts.length > 0 ? (
              <div className="space-y-3">
                {tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {tags.map((tag) => (
                      <span
                        key={getTopicTagKey(tag)}
                        className="rounded-full bg-slate-100 px-3 py-1.5 text-sm text-slate-600"
                      >
                        #{getTopicTagLabel(tag)}
                      </span>
                    ))}
                  </div>
                ) : null}
                {posts.map((post, index) => {
                  const floor = post.post_number ?? index + 1;
                  const content = renderPostContent(post);
                  const authorName = post.name || post.username || "anonymous";
                  const postTime = post.updated_at || post.created_at;

                  return (
                    <div key={post.id}>
                      <article className="rounded-xl border border-slate-200 bg-white p-3">
                        <div className="mb-2.5 flex items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2">
                            <Avatar
                              src={post.avatar_template ? buildAvatarUrl(post.avatar_template, 64) : undefined}
                              className="h-7 w-7 bg-slate-900 text-xs"
                            >
                              {authorName.slice(0, 1).toUpperCase()}
                            </Avatar>
                            <div className="text-sm font-medium text-slate-700">
                              L{floor} | {authorName}
                            </div>
                          </div>
                          <div className="text-xs text-slate-400">{formatAbsoluteTime(postTime)}</div>
                        </div>
                        <div className="max-w-none text-[15px] leading-7 text-slate-700">
                          {content ?? <p className="text-slate-500">No content</p>}
                        </div>
                      </article>

                    </div>
                  );
                })}
                {loadingMorePosts ? (
                  <div className="flex justify-center py-2">
                    <CircularProgress size={22} />
                  </div>
                ) : null}
                {!hasMorePosts ? (
                  <div className="py-2 text-center text-xs text-slate-400">No more posts</div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4 text-[15px] leading-7 text-slate-600">
                <p>{selectedTopic.excerpt || "No post content is available for this topic yet."}</p>
                <p>The detail endpoint worked, but the first post body is missing.</p>
              </div>
            )}
          </div>

        </div>
      </CardContent>
    </Card>
  );
}
