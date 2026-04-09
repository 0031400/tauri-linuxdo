import type { ReactNode } from "react";
import { Alert, Button, Card, CardContent, Chip, CircularProgress, Divider } from "@mui/material";
import type { TopicDetailResponse, TopicItem, TopicPost, TopicTag, TopicUser } from "../../types/topic";
import { formatAbsoluteTime, getTopicTagKey, getTopicTagLabel, getTopicTitle } from "../../utils/topics";

type TopicDetailPanelProps = {
  selectedTopic: TopicItem | null;
  detail: TopicDetailResponse | null;
  detailAuthor: TopicUser | null;
  detailLikeCount: number;
  detailLoading: boolean;
  detailError: string;
  firstPost: TopicPost | null;
  posts: TopicPost[];
  renderPostContent: (post: TopicPost) => ReactNode[] | null;
  onOpenOriginal: () => void;
  onKeepSelected: () => void;
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
  firstPost,
  posts,
  renderPostContent,
  onOpenOriginal,
  onKeepSelected,
}: TopicDetailPanelProps) {
  if (!selectedTopic) {
    return (
      <Card className="h-full overflow-hidden rounded-[28px] border border-slate-200 shadow-lg shadow-slate-200/70">
        <CardContent className="flex h-full items-center justify-center text-slate-500">
          No topic selected
        </CardContent>
      </Card>
    );
  }

  const tags = getTags(detail, selectedTopic);

  return (
    <Card className="h-full overflow-hidden rounded-[28px] border border-slate-200 shadow-lg shadow-slate-200/70">
      <CardContent className="flex h-full flex-col p-8">
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <div className="text-sm font-medium text-slate-500">
                {detailAuthor?.name || detailAuthor?.username || "linux.do"}
              </div>
              <h2 className="text-3xl font-semibold text-slate-900">{getTopicTitle(selectedTopic)}</h2>
            </div>
            <Chip label={`${detail?.posts_count ?? selectedTopic.posts_count ?? 0} replies`} color="primary" />
          </div>

          <Divider className="my-6" />

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-3xl bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Views</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">
                {detail?.views ?? selectedTopic.views ?? 0}
              </div>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Likes</div>
              <div className="mt-2 text-2xl font-semibold text-slate-900">{detailLikeCount}</div>
            </div>
            <div className="rounded-3xl bg-slate-50 p-4">
              <div className="text-sm text-slate-500">Created</div>
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
            ) : posts.length > 0 ? (
              <div className="space-y-4">
                {posts.map((post, index) => {
                  const floor = post.post_number ?? index + 1;
                  const content = renderPostContent(post);
                  const authorName = post.name || post.username || "anonymous";
                  const postTime = post.updated_at || post.created_at;

                  return (
                    <div key={post.id}>
                      <article className="rounded-2xl border border-slate-200 bg-white p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-slate-700">
                            L{floor} | {authorName}
                          </div>
                          <div className="text-xs text-slate-400">{formatAbsoluteTime(postTime)}</div>
                        </div>
                        <div className="max-w-none text-[15px] leading-7 text-slate-700">
                          {content ?? <p className="text-slate-500">No content</p>}
                        </div>
                      </article>

                      {index === 0 ? (
                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
                          <div className="text-sm text-slate-500">
                            {firstPost?.updated_at
                              ? `Updated at ${formatAbsoluteTime(firstPost.updated_at)}`
                              : `Created at ${formatAbsoluteTime(detail?.created_at || selectedTopic.created_at)}`}
                          </div>
                          <div className="flex gap-3">
                            <Button variant="contained" className="h-11 rounded-2xl" onClick={onOpenOriginal}>
                              Open original
                            </Button>
                            <Button variant="outlined" className="h-11 rounded-2xl" onClick={onKeepSelected}>
                              Keep selected
                            </Button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-4 text-[15px] leading-7 text-slate-600">
                <p>{selectedTopic.excerpt || "No post content is available for this topic yet."}</p>
                <p>The detail endpoint worked, but the first post body is missing.</p>
              </div>
            )}
          </div>

          {tags.length > 0 ? (
            <div className="mt-6 flex flex-wrap gap-2">
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

        </div>
      </CardContent>
    </Card>
  );
}
