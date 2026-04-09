import { useEffect, useMemo, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import { fetchLatestTopics, fetchTopicDetail, searchTopics } from "../api/linuxdo";
import type { TopicDetailResponse, TopicItem, TopicPost, TopicUser } from "../types/topic";
import { getTopicAuthor, getTopicUrl } from "../utils/topics";
import { TopicDetailPanel } from "./topics/TopicDetailPanel";
import { TopicListPanel } from "./topics/TopicListPanel";
import { renderCookedContent } from "./topics/renderCookedContent";

function getPostLikeCount(post?: TopicPost) {
  return post?.actions_summary?.find((item) => item.id === 2)?.count ?? 0;
}

function mergeTopics(current: TopicItem[], incoming: TopicItem[]) {
  const topicMap = new Map<number, TopicItem>();
  for (const topic of current) topicMap.set(topic.id, topic);
  for (const topic of incoming) topicMap.set(topic.id, topic);
  return Array.from(topicMap.values());
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
  const [searchTopicsList, setSearchTopicsList] = useState<TopicItem[]>([]);
  const [searchUsers, setSearchUsers] = useState<Record<number, TopicUser>>({});
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSlides, setLightboxSlides] = useState<Array<{ src: string }>>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const refreshTopics = async () => {
    setLoading(true);
    setError("");

    try {
      const data = await fetchLatestTopics(0);
      const nextTopics = data.topic_list?.topics ?? [];
      const nextUsers = Object.fromEntries((data.users ?? []).map((user) => [user.id, user] as const));

      setTopics(nextTopics);
      setUsers(nextUsers);
      setPage(0);
      setHasMore(Boolean(data.topic_list?.more_topics_url));
      setSelectedId((currentId) => currentId ?? nextTopics[0]?.id ?? null);
    } catch (err) {
      console.error(err);
      setTopics([]);
      setUsers({});
      setSelectedId(null);
      setDetail(null);
      if (err instanceof Error && err.message === "AUTH_REQUIRED") {
        setError("Please log in before loading topics.");
      } else {
        setError("Failed to load topic list.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshTopics();
  }, []);

  useEffect(() => {
    const term = keyword.trim();
    if (!term) {
      setSearchTopicsList([]);
      setSearchUsers({});
      setSearchError("");
      setSearchLoading(false);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      void (async () => {
        setSearchLoading(true);
        setSearchError("");

        try {
          const data = await searchTopics(term, 1);
          if (cancelled) return;

          const nextUsers = Object.fromEntries(data.users.map((user) => [user.id, user] as const));
          setSearchTopicsList(data.topics);
          setSearchUsers(nextUsers);
          setSelectedId((currentId) => {
            if (currentId && data.topics.some((topic) => topic.id === currentId)) {
              return currentId;
            }
            return data.topics[0]?.id ?? null;
          });
        } catch (err) {
          console.error(err);
          if (!cancelled) {
            setSearchTopicsList([]);
            setSearchUsers({});
            setSearchError("Failed to search topics.");
          }
        } finally {
          if (!cancelled) {
            setSearchLoading(false);
          }
        }
      })();
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [keyword]);

  const usingSearch = keyword.trim().length > 0;
  const visibleTopics = usingSearch ? searchTopicsList : topics;
  const visibleUsers = useMemo(
    () => (usingSearch ? { ...users, ...searchUsers } : users),
    [searchUsers, usingSearch, users],
  );

  const selectedTopic =
    visibleTopics.find((topic) => topic.id === selectedId) ?? visibleTopics[0] ?? null;

  const loadMoreTopics = async () => {
    if (usingSearch || loading || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const data = await fetchLatestTopics(nextPage);
      const incomingTopics = data.topic_list?.topics ?? [];
      const incomingUsers = Object.fromEntries((data.users ?? []).map((user) => [user.id, user] as const));

      setTopics((current) => mergeTopics(current, incomingTopics));
      setUsers((current) => ({ ...current, ...incomingUsers }));
      setPage(nextPage);
      setHasMore(Boolean(data.topic_list?.more_topics_url));
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMore(false);
    }
  };

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
          setDetailError("Failed to load topic detail.");
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

  const selectedAuthor = selectedTopic ? getTopicAuthor(selectedTopic, visibleUsers) : null;
  const selectedTopicUrl = selectedTopic ? getTopicUrl(selectedTopic) : null;
  const posts = detail?.post_stream?.posts ?? [];
  const firstPost = posts[0] ?? null;
  const detailAuthor = detail?.details?.created_by ?? selectedAuthor ?? null;
  const detailLikeCount = detail?.like_count ?? getPostLikeCount(firstPost ?? undefined);

  const postContentMap = useMemo(() => {
    const result = new Map<number, ReturnType<typeof renderCookedContent>>();
    for (const post of posts) {
      if (!post.cooked) continue;
      result.set(
        post.id,
        renderCookedContent(post.cooked, {
          onOpenImage: (url) => {
            setLightboxSlides([{ src: url }]);
            setLightboxIndex(0);
            setLightboxOpen(true);
          },
          onOpenLink: (url) => void openUrl(url),
        }),
      );
    }
    return result;
  }, [posts]);

  return (
    <div className="grid h-[calc(100vh-3rem)] grid-cols-[460px_minmax(0,1fr)] gap-6">
      <TopicListPanel
        filteredTopics={visibleTopics}
        selectedTopic={selectedTopic}
        users={visibleUsers}
        loading={loading || searchLoading}
        error={searchError || error}
        keyword={keyword}
        onKeywordChange={setKeyword}
        onRefresh={() => {
          if (usingSearch) {
            const term = keyword.trim();
            if (!term) return;
            setSearchLoading(true);
            setSearchError("");
            void searchTopics(term, 1)
              .then((data) => {
                const nextUsers = Object.fromEntries(data.users.map((user) => [user.id, user] as const));
                setSearchTopicsList(data.topics);
                setSearchUsers(nextUsers);
                setSelectedId((currentId) => {
                  if (currentId && data.topics.some((topic) => topic.id === currentId)) {
                    return currentId;
                  }
                  return data.topics[0]?.id ?? null;
                });
              })
              .catch((err: unknown) => {
                console.error(err);
                setSearchTopicsList([]);
                setSearchUsers({});
                setSearchError("Failed to search topics.");
              })
              .finally(() => {
                setSearchLoading(false);
              });
            return;
          }
          void refreshTopics();
        }}
        onSelectTopic={setSelectedId}
        loadingMore={usingSearch ? false : loadingMore}
        hasMore={usingSearch ? false : hasMore}
        onLoadMore={() => {
          void loadMoreTopics();
        }}
      />

      <TopicDetailPanel
        selectedTopic={selectedTopic}
        detail={detail}
        detailAuthor={detailAuthor}
        detailLikeCount={detailLikeCount}
        detailLoading={detailLoading}
        detailError={detailError}
        firstPost={firstPost}
        posts={posts}
        renderPostContent={(post) => postContentMap.get(post.id) ?? null}
        onOpenOriginal={() => {
          if (selectedTopicUrl) {
            void openUrl(selectedTopicUrl);
          }
        }}
        onKeepSelected={() => {
          if (selectedTopic?.id) {
            window.location.hash = `#/topics?topic=${selectedTopic.id}`;
          }
        }}
      />

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={lightboxSlides}
        index={lightboxIndex}
      />
    </div>
  );
}
