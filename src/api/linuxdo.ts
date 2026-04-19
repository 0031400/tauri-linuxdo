import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import { load } from "@tauri-apps/plugin-store";
import type {
  LatestTopicsResponse,
  TopicCategory,
  SearchTopicsResponse,
  TopicDetailResponse,
  TopicItem,
  TopicPost,
} from "../types/topic";
import { BASE_URL } from "../utils/topics";
import { logLinuxDoHttpError } from "../utils/logger";
import { notifySessionChanged } from "../utils/session";

const COOKIE_STORE_PATH = "linuxdo.store.json";
const COOKIE_STORE_KEY = "linuxdo-cookie-header";

let linuxDoCookieHeader = "";
let cookieStorePromise: ReturnType<typeof load> | null = null;
let allTopicCategoriesCache: TopicCategory[] | null = null;
let allTopicCategoriesPromise: Promise<TopicCategory[]> | null = null;

function getBrowserUserAgent() {
  if (typeof navigator === "undefined") return "";
  return navigator.userAgent?.trim() ?? "";
}

function getCookieStore() {
  if (!cookieStorePromise) {
    cookieStorePromise = load(COOKIE_STORE_PATH, {
      defaults: {},
      autoSave: true,
    });
  }
  return cookieStorePromise;
}

export async function hydrateLinuxDoCookieHeader() {
  const store = await getCookieStore();
  const savedCookieHeader = await store.get<string>(COOKIE_STORE_KEY);
  linuxDoCookieHeader =
    typeof savedCookieHeader === "string" ? savedCookieHeader.trim() : "";
}

export function getLinuxDoCookieHeader() {
  return linuxDoCookieHeader;
}

export async function setLinuxDoCookieHeader(
  cookieHeader: string | null | undefined,
) {
  linuxDoCookieHeader = (cookieHeader ?? "").trim();
  const store = await getCookieStore();
  if (linuxDoCookieHeader) {
    await store.set(COOKIE_STORE_KEY, linuxDoCookieHeader);
  } else {
    await store.delete(COOKIE_STORE_KEY);
  }
}

export async function clearLinuxDoCookieHeader() {
  linuxDoCookieHeader = "";
  const store = await getCookieStore();
  await store.delete(COOKIE_STORE_KEY);
}

export async function openLinuxDoLogin() {
  return invoke("open_login_webview");
}

export async function clearLinuxDoBrowsingData() {
  return invoke("clear_linuxdo_browsing_data");
}

export async function takePendingLinuxDoLoginCookie() {
  return invoke<string | null>("take_pending_login_cookie");
}

async function readErrorBody(response: Response) {
  try {
    return await response.text();
  } catch (error) {
    return `<<failed to read body: ${error instanceof Error ? error.message : String(error)}>>`;
  }
}

async function throwHttpError(context: string, response: Response): Promise<never> {
  const body = await readErrorBody(response);
  console.error(`[linuxdo] ${context} failed`, {
    url: response.url,
    status: response.status,
    body,
  });
  await logLinuxDoHttpError(context, response.url, response.status, body);
  throw new Error(`HTTP ${response.status}: ${body}`);
}

function createAuthHeaders(extraHeaders?: Record<string, string>) {
  const cookieHeader = getLinuxDoCookieHeader();
  const userAgent = getBrowserUserAgent();

  if (!cookieHeader) {
    throw new Error("AUTH_REQUIRED");
  }

  return {
    Cookie: cookieHeader,
    Referer: `${BASE_URL}/`,
    Origin: BASE_URL,
    ...(userAgent ? { "User-Agent": userAgent } : {}),
    ...extraHeaders,
  };
}

export function hasLinuxDoSession() {
  return /(?:^|;\s*)_t=/.test(getLinuxDoCookieHeader());
}

export async function logoutLinuxDo() {
  await clearLinuxDoBrowsingData();
  await clearLinuxDoCookieHeader();
  clearTopicCategoriesCache();
  notifySessionChanged();
}

export async function syncLinuxDoSession(source: string) {
  await hydrateLinuxDoCookieHeader();

  const pendingCookieHeader = await takePendingLinuxDoLoginCookie();
  const receivedCookie = typeof pendingCookieHeader === "string" && pendingCookieHeader.trim().length > 0;

  if (receivedCookie) {
    await setLinuxDoCookieHeader(pendingCookieHeader);
  }

  const loggedIn = hasLinuxDoSession();
  if (loggedIn) {
    notifySessionChanged();
  }

  return {
    loggedIn,
    receivedCookie,
    source,
  };
}

export async function fetchLatestTopics(page = 0) {
  const url = new URL(`${BASE_URL}/latest.json`);
  if (page > 0) {
    url.searchParams.set("page", String(page));
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: createAuthHeaders(),
  });

  if (!response.ok) {
    await throwHttpError("fetchLatestTopics", response);
  }

  return response.json() as Promise<LatestTopicsResponse>;
}

export async function fetchLatestTopicsByCategory(categorySlug: string, page = 0) {
  const safeSlug = categorySlug.trim();
  if (!safeSlug) {
    return fetchLatestTopics(page);
  }

  const pathParts = safeSlug
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => encodeURIComponent(part));
  if (pathParts.length === 0) {
    return fetchLatestTopics(page);
  }

  const url = new URL(`${BASE_URL}/c/${pathParts.join("/")}/l/latest.json`);
  if (page > 0) {
    url.searchParams.set("page", String(page));
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: createAuthHeaders(),
  });

  if (!response.ok) {
    await throwHttpError("fetchLatestTopicsByCategory", response);
  }

  return response.json() as Promise<LatestTopicsResponse>;
}

export async function fetchTopicCategories() {
  const response = await fetch(`${BASE_URL}/categories.json`, {
    method: "GET",
    headers: createAuthHeaders(),
  });

  if (!response.ok) {
    await throwHttpError("fetchTopicCategories", response);
  }

  const data = (await response.json()) as {
    category_list?: {
      categories?: Array<{
        id?: number;
        name?: string;
        slug?: string;
        parent_category_id?: number | null;
      }>;
    };
  };

  return normalizeTopicCategories(data);
}

export async function fetchTopicCategoriesByParent(parentCategoryId: number) {
  const url = new URL(`${BASE_URL}/categories.json`);
  url.searchParams.set("parent_category_id", String(parentCategoryId));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: createAuthHeaders(),
  });

  if (!response.ok) {
    await throwHttpError("fetchTopicCategoriesByParent", response);
  }

  const data = (await response.json()) as {
    category_list?: {
      categories?: Array<{
        id?: number;
        name?: string;
        slug?: string;
        parent_category_id?: number | null;
      }>;
    };
  };

  return normalizeTopicCategories(data);
}

export function clearTopicCategoriesCache() {
  allTopicCategoriesCache = null;
  allTopicCategoriesPromise = null;
}

export async function fetchAllTopicCategories() {
  if (allTopicCategoriesCache) {
    return allTopicCategoriesCache;
  }
  if (allTopicCategoriesPromise) {
    return allTopicCategoriesPromise;
  }

  allTopicCategoriesPromise = (async () => {
    const topCategories = await fetchTopicCategories();
    const parentCandidates = topCategories.filter((item) => !item.parent_category_id);
    const childCategoryGroups = await Promise.all(
      parentCandidates.map(async (parent) => {
        try {
          return await fetchTopicCategoriesByParent(parent.id);
        } catch {
          return [] as TopicCategory[];
        }
      }),
    );

    const merged = new Map<number, TopicCategory>();
    for (const item of topCategories) merged.set(item.id, item);
    for (const group of childCategoryGroups) {
      for (const item of group) merged.set(item.id, item);
    }

    const all = Array.from(merged.values());
    allTopicCategoriesCache = all;
    return all;
  })();

  try {
    return await allTopicCategoriesPromise;
  } finally {
    allTopicCategoriesPromise = null;
  }
}

function normalizeTopicCategories(data: {
  category_list?: {
    categories?: Array<{
      id?: number;
      name?: string;
      slug?: string;
      parent_category_id?: number | null;
    }>;
  };
}) {
  return (data.category_list?.categories ?? [])
    .filter(
      (
        item,
      ): item is {
        id: number;
        name: string;
        slug: string;
        parent_category_id?: number | null;
      } => {
      return (
        typeof item.id === "number" &&
        Number.isInteger(item.id) &&
        item.id > 0 &&
        typeof item.name === "string" &&
        item.name.trim().length > 0 &&
        typeof item.slug === "string" &&
        item.slug.trim().length > 0
      );
    },
    )
    .map(
      (item) =>
        ({
          id: item.id,
          name: item.name,
          slug: item.slug,
          parent_category_id:
            typeof item.parent_category_id === "number" && Number.isInteger(item.parent_category_id)
              ? item.parent_category_id
              : null,
        }) satisfies TopicCategory,
    );
}

export async function fetchTopicDetail(topicId: number) {
  const response = await fetch(`${BASE_URL}/t/${topicId}/1.json`, {
    method: "GET",
    headers: createAuthHeaders(),
  });

  if (!response.ok) {
    await throwHttpError("fetchTopicPosts", response);
  }

  return response.json() as Promise<TopicDetailResponse>;
}

export async function fetchTopicPosts(topicId: number, postIds: number[]) {
  if (postIds.length === 0) return [] as TopicPost[];

  const url = new URL(`${BASE_URL}/t/${topicId}/posts.json`);
  for (const postId of postIds) {
    url.searchParams.append("post_ids[]", String(postId));
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: createAuthHeaders(),
  });

  if (!response.ok) {
    await throwHttpError("searchTopics", response);
  }

  const data = (await response.json()) as {
    post_stream?: {
      posts?: TopicPost[];
    };
    posts?: TopicPost[];
  };

  return data.post_stream?.posts ?? data.posts ?? [];
}

type SearchRawResponse = {
  topics?: Array<
    TopicItem & {
      bumped_at?: string;
      highest_post_number?: number;
      reply_count?: number;
    }
  >;
  users?: SearchTopicsResponse["users"];
  grouped_search_result?: {
    more_posts?: boolean;
    more_full_page_results?: boolean;
  };
};

export async function searchTopics(query: string, page = 1) {
  const term = query.trim();
  if (!term) {
    return {
      topics: [],
      users: [],
      hasMore: false,
    } satisfies SearchTopicsResponse;
  }

  const url = new URL(`${BASE_URL}/search.json`);
  url.searchParams.set("q", term);
  url.searchParams.set("type_filter", "topic");
  if (page > 1) {
    url.searchParams.set("page", String(page));
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: createAuthHeaders(),
  });

  if (!response.ok) {
    await throwHttpError("fetchLatestTopics", response);
  }

  const raw = (await response.json()) as SearchRawResponse;
  const topics = (raw.topics ?? []).map((topic) => ({
    ...topic,
    posts_count: topic.posts_count ?? topic.highest_post_number ?? topic.reply_count ?? 0,
    last_posted_at: topic.last_posted_at ?? topic.bumped_at,
  }));

  return {
    topics,
    users: raw.users ?? [],
    hasMore: Boolean(
      raw.grouped_search_result?.more_full_page_results || raw.grouped_search_result?.more_posts,
    ),
  } satisfies SearchTopicsResponse;
}
