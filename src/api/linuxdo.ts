import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import type { LatestTopicsResponse, TopicDetailResponse } from "../types/topic";
import { BASE_URL } from "../utils/topics";

type CsrfResponse = {
  csrf?: string;
};

export async function getLinuxDoCookieHeader() {
  return invoke<string | null>("get_linuxdo_cookie_header");
}

export async function openLinuxDoLogin() {
  return invoke("open_login_webview");
}

async function createAuthHeaders(extraHeaders?: Record<string, string>) {
  const cookieHeader = await getLinuxDoCookieHeader();

  if (!cookieHeader || !cookieHeader.trim()) {
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
  const cookieHeader = await getLinuxDoCookieHeader();
  if (!cookieHeader || !cookieHeader.trim()) {
    return false;
  }

  return /(?:^|;\s*)_t=/.test(cookieHeader);
}

export async function fetchCsrfToken() {
  const response = await fetch(`${BASE_URL}/session/csrf`, {
    method: "GET",
    headers: await createAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const data = (await response.json()) as CsrfResponse;
  const csrfToken = data.csrf?.trim();

  if (!csrfToken) {
    throw new Error("CSRF_TOKEN_MISSING");
  }

  return csrfToken;
}

export async function logoutLinuxDo() {
  const sessionResponse = await fetch(`${BASE_URL}/session/current.json`, {
    method: "GET",
    headers: await createAuthHeaders(),
  });

  if (!sessionResponse.ok) {
    throw new Error(`HTTP ${sessionResponse.status}`);
  }

  const session = (await sessionResponse.json()) as {
    current_user?: {
      username?: string;
    } | null;
  };
  const username = session.current_user?.username?.trim();

  if (!username) {
    throw new Error("AUTH_REQUIRED");
  }

  const csrfToken = await fetchCsrfToken();
  const response = await fetch(`${BASE_URL}/session/${encodeURIComponent(username)}`, {
    method: "DELETE",
    headers: await createAuthHeaders({
      "X-CSRF-Token": csrfToken,
    }),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
}

export async function fetchLatestTopics() {
  const response = await fetch(`${BASE_URL}/latest.json`, {
    method: "GET",
    headers: await createAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json() as Promise<LatestTopicsResponse>;
}

export async function fetchTopicDetail(topicId: number) {
  const response = await fetch(`${BASE_URL}/t/${topicId}/1.json`, {
    method: "GET",
    headers: await createAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json() as Promise<TopicDetailResponse>;
}
