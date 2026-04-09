import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import type { LatestTopicsResponse, TopicDetailResponse } from "../types/topic";
import { BASE_URL } from "../utils/topics";

export async function getLinuxDoCookieHeader() {
  return invoke<string | null>("get_linuxdo_cookie_header");
}

export async function openLinuxDoLogin() {
  return invoke("open_login_webview");
}

export async function clearLinuxDoBrowsingData() {
  return invoke("clear_linuxdo_browsing_data");
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

export async function logoutLinuxDo() {
  await clearLinuxDoBrowsingData();
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
