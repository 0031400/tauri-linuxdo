import { invoke } from "@tauri-apps/api/core";
import { fetch } from "@tauri-apps/plugin-http";
import type { LatestTopicsResponse } from "../types/topic";
import { BASE_URL } from "../utils/topics";

type CurrentSessionResponse = {
  current_user?: {
    username?: string;
  } | null;
};

type CsrfResponse = {
  csrf?: string;
};

export async function getLinuxDoCookieHeader() {
  return invoke<string | null>("get_linuxdo_cookie_header");
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

export async function fetchCurrentSession() {
  const response = await fetch(`${BASE_URL}/session/current.json`, {
    method: "GET",
    headers: await createAuthHeaders(),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  return response.json() as Promise<CurrentSessionResponse>;
}

export async function hasLinuxDoSession() {
  const session = await fetchCurrentSession();
  return Boolean(session.current_user?.username?.trim());
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
  const session = await fetchCurrentSession();
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
