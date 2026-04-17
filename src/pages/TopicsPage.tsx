import { useEffect, useMemo, useRef, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { useLocation, useNavigate } from "react-router-dom";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import {
  fetchLatestTopics,
  fetchLatestTopicsByCategory,
  fetchTopicDetail,
  fetchTopicPosts,
  openTopicWindow,
  searchTopics,
} from "../api/linuxdo";
import type { TopicDetailResponse, TopicItem, TopicPost, TopicUser } from "../types/topic";
import { getTopicAuthor } from "../utils/topics";
import { readLayoutNumber, writeLayoutNumber } from "../utils/layoutStore";
import { getPlatformCapabilities } from "../utils/platform";
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

function mergePosts(current: TopicPost[], incoming: TopicPost[]) {
  const postMap = new Map<number, TopicPost>();
  for (const post of current) postMap.set(post.id, post);
  for (const post of incoming) postMap.set(post.id, post);
  return Array.from(postMap.values()).sort((a, b) => (a.post_number ?? 0) - (b.post_number ?? 0));
}

function extractLinuxDoTopicId(url: string) {
  try {
    const parsed = new URL(url, "https://linux.do");
    if (!/linux\.do$/i.test(parsed.hostname)) return null;

    const parts = parsed.pathname.split("/").filter(Boolean);
    if (parts[0] !== "t") return null;

    for (let i = parts.length - 1; i >= 1; i -= 1) {
      const value = Number(parts[i]);
      if (Number.isInteger(value) && value > 0) {
        return value;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export function TopicsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile, supportsMultiWindow } = getPlatformCapabilities();
  const query = new URLSearchParams(location.search);
  const isMinimal = query.get("minimal") === "1";
  const topicParam = query.get("topic")?.trim() || "";
  const hasTopicParam = /^[1-9]\d*$/.test(topicParam);
  const selectedCategorySlug = query.get("category")?.trim() || "";
  const panelsRef = useRef<HTMLDivElement | null>(null);
  const [listWidth, setListWidth] = useState(420);
  const [listWidthReady, setListWidthReady] = useState(false);
  const draggingListRef = useRef(false);
  const detailPanelRef = useRef<HTMLDivElement | null>(null);
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [users, setUsers] = useState<Record<number, TopicUser>>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState<TopicDetailResponse | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [detailPosts, setDetailPosts] = useState<TopicPost[]>([]);
  const [detailStreamPostIds, setDetailStreamPostIds] = useState<number[]>([]);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [searchTopicsList, setSearchTopicsList] = useState<TopicItem[]>([]);
  const [searchUsers, setSearchUsers] = useState<Record<number, TopicUser>>({});
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [searchPage, setSearchPage] = useState(1);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxSlides, setLightboxSlides] = useState<Array<{ src: string }>>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const detailRequestIdRef = useRef(0);

  useEffect(() => {
    if (isMobile) return;
    void readLayoutNumber("layout.topicsListWidth", 420).then((value) => {
      setListWidth(Math.max(300, Math.min(720, Math.round(value))));
      setListWidthReady(true);
    });
  }, [isMobile]);

  useEffect(() => {
    if (isMobile || !listWidthReady || isMinimal) return;
    const timer = window.setTimeout(() => {
      void writeLayoutNumber("layout.topicsListWidth", listWidth);
    }, 1000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [isMinimal, isMobile, listWidth, listWidthReady]);

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      if (!draggingListRef.current || isMinimal || isMobile) return;
      const panelsRect = panelsRef.current?.getBoundingClientRect();
      if (!panelsRect) return;
      const next = Math.max(300, Math.min(720, Math.round(event.clientX - panelsRect.left)));
      setListWidth(next);
    };

    const onMouseUp = () => {
      draggingListRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [isMinimal, isMobile]);

  const refreshTopics = async () => {
    setLoading(true);
    setError("");

    try {
      const data = selectedCategorySlug
        ? await fetchLatestTopicsByCategory(selectedCategorySlug, 0)
        : await fetchLatestTopics(0);
      const nextTopics = data.topic_list?.topics ?? [];
      const nextUsers = Object.fromEntries((data.users ?? []).map((user) => [user.id, user] as const));

      setTopics(nextTopics);
      setUsers(nextUsers);
      setPage(0);
      setHasMore(Boolean(data.topic_list?.more_topics_url));
      setSelectedId((currentId) => currentId ?? nextTopics[0]?.id ?? null);
      if (isMobile && !hasTopicParam) {
        setSelectedId(null);
      }
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
    if (isMinimal) return;
    void refreshTopics();
  }, [isMinimal, selectedCategorySlug, isMobile, hasTopicParam]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const topicValue = params.get("topic");
    if (!topicValue) return;

    const topicId = Number(topicValue);
    if (!Number.isInteger(topicId) || topicId <= 0) return;

    setSelectedId(topicId);
  }, [location.search]);

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
          setSearchPage(1);
          setSearchHasMore(data.hasMore);
          if (isMobile && !hasTopicParam) {
            setSelectedId(null);
            return;
          }
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
  }, [keyword, isMobile, hasTopicParam]);

  const loadMoreSearchTopics = async () => {
    if (searchLoading || searchLoadingMore || !searchHasMore) return;
    const term = keyword.trim();
    if (!term) return;

    setSearchLoadingMore(true);
    setSearchError("");
    try {
      const nextPage = searchPage + 1;
      const data = await searchTopics(term, nextPage);
      const incomingUsers = Object.fromEntries(data.users.map((user) => [user.id, user] as const));
      setSearchTopicsList((current) => mergeTopics(current, data.topics));
      setSearchUsers((current) => ({ ...current, ...incomingUsers }));
      setSearchPage(nextPage);
      setSearchHasMore(data.hasMore);
    } catch (err) {
      console.error(err);
      setSearchError("Failed to load more search results.");
    } finally {
      setSearchLoadingMore(false);
    }
  };

  const usingSearch = keyword.trim().length > 0;
  const visibleTopics = usingSearch ? searchTopicsList : topics;
  const visibleUsers = useMemo(
    () => (usingSearch ? { ...users, ...searchUsers } : users),
    [searchUsers, usingSearch, users],
  );

  const selectedTopic = useMemo(() => {
    if (selectedId) {
      return (
        visibleTopics.find((topic) => topic.id === selectedId) ??
        topics.find((topic) => topic.id === selectedId) ??
        searchTopicsList.find((topic) => topic.id === selectedId) ??
        ({ id: selectedId } as TopicItem)
      );
    }
    if (isMobile && !hasTopicParam) {
      return null;
    }
    return visibleTopics[0] ?? null;
  }, [searchTopicsList, selectedId, topics, visibleTopics, isMobile, hasTopicParam]);

  const loadMoreTopics = async () => {
    if (usingSearch || loading || loadingMore || !hasMore) return;

    setLoadingMore(true);
    try {
      const nextPage = page + 1;
      const data = selectedCategorySlug
        ? await fetchLatestTopicsByCategory(selectedCategorySlug, nextPage)
        : await fetchLatestTopics(nextPage);
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

  const refreshDetail = async (topicId: number) => {
    const requestId = detailRequestIdRef.current + 1;
    detailRequestIdRef.current = requestId;

    setDetailLoading(true);
    setDetailError("");

    try {
      const data = await fetchTopicDetail(topicId);
      if (requestId !== detailRequestIdRef.current) return;
      setDetail(data);
      const initialPosts = data.post_stream?.posts ?? [];
      const streamIds = data.post_stream?.stream ?? initialPosts.map((post) => post.id);
      setDetailPosts(initialPosts);
      setDetailStreamPostIds(streamIds);
      setHasMorePosts(streamIds.length > initialPosts.length);
      setLoadingMorePosts(false);
    } catch (err) {
      console.error(err);
      if (requestId !== detailRequestIdRef.current) return;
      setDetail(null);
      setDetailPosts([]);
      setDetailStreamPostIds([]);
      setHasMorePosts(false);
      setLoadingMorePosts(false);
      setDetailError("Failed to load topic detail.");
    } finally {
      if (requestId === detailRequestIdRef.current) {
        setDetailLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!selectedTopic?.id) {
      detailRequestIdRef.current += 1;
      setDetail(null);
      setDetailPosts([]);
      setDetailStreamPostIds([]);
      setHasMorePosts(false);
      setLoadingMorePosts(false);
      setDetailError("");
      setDetailLoading(false);
      return;
    }
    void refreshDetail(selectedTopic.id);
  }, [selectedTopic?.id]);

  const loadMoreDetailPosts = async () => {
    if (!selectedTopic?.id || detailLoading || loadingMorePosts || !hasMorePosts) return;

    const loadedIdSet = new Set(detailPosts.map((post) => post.id));
    const nextIds = detailStreamPostIds.filter((id) => !loadedIdSet.has(id)).slice(0, 20);
    if (nextIds.length === 0) {
      setHasMorePosts(false);
      return;
    }

    setLoadingMorePosts(true);
    try {
      const incomingPosts = await fetchTopicPosts(selectedTopic.id, nextIds);
      setDetailPosts((current) => {
        const merged = mergePosts(current, incomingPosts);
        const mergedIdSet = new Set(merged.map((post) => post.id));
        setHasMorePosts(detailStreamPostIds.some((id) => !mergedIdSet.has(id)));
        return merged;
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingMorePosts(false);
    }
  };

  const selectedAuthor = selectedTopic ? getTopicAuthor(selectedTopic, visibleUsers) : null;
  const posts = detailPosts;
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
          onOpenLink: (url) => {
            if (url.startsWith("#")) {
              return;
            }
            const topicId = extractLinuxDoTopicId(url);
            if (topicId) {
              if (isMobile || !supportsMultiWindow) {
                const params = new URLSearchParams(location.search);
                params.set("topic", String(topicId));
                navigate(`/topics?${params.toString()}`);
                return;
              }
              void (async () => {
                const detailWidth = detailPanelRef.current
                  ? Math.round(detailPanelRef.current.getBoundingClientRect().width)
                  : undefined;
                const savedMainHeight = await readLayoutNumber(
                  "layout.mainWindowHeight",
                  Math.max(window.innerHeight, 540),
                );
                const fallbackLogicalHeight = Math.max(window.innerHeight, 540);
                const dpr = Math.max(window.devicePixelRatio || 1, 1);
                const normalizedHeight =
                  savedMainHeight > fallbackLogicalHeight * 1.25
                    ? savedMainHeight / dpr
                    : savedMainHeight;
                await openTopicWindow(topicId, detailWidth, normalizedHeight);
              })();
              return;
            }
            void openUrl(url);
          },
        }),
      );
    }
    return result;
  }, [isMobile, location.search, navigate, posts, supportsMultiWindow]);

  const closeTopicDetail = () => {
    const params = new URLSearchParams(location.search);
    params.delete("topic");
    const nextQuery = params.toString();
    navigate(nextQuery ? `/topics?${nextQuery}` : "/topics");
  };

  const selectTopic = (topicId: number) => {
    if (isMobile) {
      const params = new URLSearchParams(location.search);
      params.set("topic", String(topicId));
      navigate(`/topics?${params.toString()}`);
      return;
    }
    setSelectedId(topicId);
  };

  return (
    <>
      {isMinimal ? (
        <div className="h-[calc(100vh-1.5rem)]">
          <TopicDetailPanel
            selectedTopic={selectedTopic}
            detail={detail}
            detailAuthor={detailAuthor}
            detailLikeCount={detailLikeCount}
            detailLoading={detailLoading}
            detailError={detailError}
            posts={posts}
            renderPostContent={(post) => postContentMap.get(post.id) ?? null}
            loadingMorePosts={loadingMorePosts}
            hasMorePosts={hasMorePosts}
            onLoadMorePosts={() => {
              void loadMoreDetailPosts();
            }}
            onRetryDetail={() => {
              if (!selectedTopic?.id) return;
              void refreshDetail(selectedTopic.id);
            }}
          />
        </div>
      ) : isMobile ? (
        <div className="flex h-[calc(100vh-2rem)] flex-col gap-2">
          {hasTopicParam ? (
            <button
              type="button"
              className="self-start rounded-lg bg-slate-900 px-3 py-1.5 text-sm text-white"
              onClick={closeTopicDetail}
            >
              Back To List
            </button>
          ) : null}

          <div className="min-h-0 flex-1">
            {hasTopicParam ? (
              <TopicDetailPanel
                selectedTopic={selectedTopic}
                detail={detail}
                detailAuthor={detailAuthor}
                detailLikeCount={detailLikeCount}
                detailLoading={detailLoading}
                detailError={detailError}
                posts={posts}
                renderPostContent={(post) => postContentMap.get(post.id) ?? null}
                loadingMorePosts={loadingMorePosts}
                hasMorePosts={hasMorePosts}
                onLoadMorePosts={() => {
                  void loadMoreDetailPosts();
                }}
                onRetryDetail={() => {
                  if (!selectedTopic?.id) return;
                  void refreshDetail(selectedTopic.id);
                }}
              />
            ) : (
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
                        setSearchPage(1);
                        setSearchHasMore(data.hasMore);
                        setSelectedId(null);
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
                onSelectTopic={selectTopic}
                loadingMore={usingSearch ? searchLoadingMore : loadingMore}
                hasMore={usingSearch ? searchHasMore : hasMore}
                onLoadMore={() => {
                  if (usingSearch) {
                    void loadMoreSearchTopics();
                    return;
                  }
                  void loadMoreTopics();
                }}
              />
            )}
          </div>
        </div>
      ) : (
        <div ref={panelsRef} className="flex h-[calc(100vh-2rem)] gap-3">
          <div className="shrink-0" style={{ width: `${listWidth}px` }}>
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
                      setSearchPage(1);
                      setSearchHasMore(data.hasMore);
                      if (isMobile && !hasTopicParam) {
                        setSelectedId(null);
                        return;
                      }
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
              onSelectTopic={selectTopic}
              loadingMore={usingSearch ? searchLoadingMore : loadingMore}
              hasMore={usingSearch ? searchHasMore : hasMore}
              onLoadMore={() => {
                if (usingSearch) {
                  void loadMoreSearchTopics();
                  return;
                }
                void loadMoreTopics();
              }}
            />
          </div>

          <div
            className="w-1 shrink-0 cursor-col-resize rounded bg-slate-200/80 hover:bg-slate-300"
            onMouseDown={() => {
              draggingListRef.current = true;
              document.body.style.cursor = "col-resize";
              document.body.style.userSelect = "none";
            }}
          />

          <div ref={detailPanelRef} className="min-w-0 flex-1">
            <TopicDetailPanel
              selectedTopic={selectedTopic}
              detail={detail}
              detailAuthor={detailAuthor}
              detailLikeCount={detailLikeCount}
              detailLoading={detailLoading}
              detailError={detailError}
              posts={posts}
              renderPostContent={(post) => postContentMap.get(post.id) ?? null}
              loadingMorePosts={loadingMorePosts}
              hasMorePosts={hasMorePosts}
              onLoadMorePosts={() => {
                void loadMoreDetailPosts();
              }}
              onRetryDetail={() => {
                if (!selectedTopic?.id) return;
                void refreshDetail(selectedTopic.id);
              }}
            />
          </div>
        </div>
      )}

      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={lightboxSlides}
        index={lightboxIndex}
      />
    </>
  );
}
