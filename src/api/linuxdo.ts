import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import type { LatestTopicsResponse } from "../types/topic";
import { BASE_URL } from "../utils/topics";

export async function getLinuxDoCookieHeader() {
  return invoke<string | null>("get_linuxdo_cookie_header");
}

export async function fetchLatestTopics() {
  const cookieHeader = await getLinuxDoCookieHeader();

  if (!cookieHeader || !cookieHeader.trim()) {
    throw new Error("AUTH_REQUIRED");
  }

  const response = await fetch(`${BASE_URL}/latest.json`, {
    method: "GET",
    headers: {
      Cookie: cookieHeader,
      Referer: `${BASE_URL}/`,
      Origin: BASE_URL,
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json() as Promise<LatestTopicsResponse>;
}
