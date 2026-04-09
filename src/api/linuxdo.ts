import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import { load } from "@tauri-apps/plugin-store";
import type {
  LatestTopicsResponse,
  SearchTopicsResponse,
  TopicDetailResponse,
  TopicItem,
} from "../types/topic";
import { BASE_URL } from "../utils/topics";

const COOKIE_STORE_PATH = "linuxdo.store.json";
const COOKIE_STORE_KEY = "linuxdo-cookie-header";

let linuxDoCookieHeader = "";
let cookieStorePromise: ReturnType<typeof load> | null = null;

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

function createAuthHeaders(extraHeaders?: Record<string, string>) {
  const cookieHeader = getLinuxDoCookieHeader();

  if (!cookieHeader) {
    throw new Error("AUTH_REQUIRED");
  }

  return {
    Cookie: cookieHeader,
    Referer: `${BASE_URL}/`,
    Origin: BASE_URL,
    ...extraHeaders,
  };
}

export async function hasLinuxDoSession() {
  return /(?:^|;\s*)_t=/.test(getLinuxDoCookieHeader());
}

export async function logoutLinuxDo() {
  await clearLinuxDoBrowsingData();
  await clearLinuxDoCookieHeader();
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
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json() as Promise<LatestTopicsResponse>;
}

export async function fetchTopicDetail(topicId: number) {
  const response = await fetch(`${BASE_URL}/t/${topicId}/1.json`, {
    method: "GET",
    headers: createAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json() as Promise<TopicDetailResponse>;
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

  const url = new URL(`${BASE_URL}/search/query.json`);
  url.searchParams.set("term", term);
  url.searchParams.set("page", String(page));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: createAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
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
