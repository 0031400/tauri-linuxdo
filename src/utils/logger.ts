import { error, info } from "@tauri-apps/plugin-log";

const LINUXDO_LOG_SOURCE = "linuxdo-session";

export async function logReceivedLinuxDoCookie(
  cookieHeader: string,
  source: string,
) {
  const normalizedCookie = cookieHeader.trim();
  if (!normalizedCookie) {
    return;
  }

  try {
    await info(`[${LINUXDO_LOG_SOURCE}] received backend cookie from ${source}: ${normalizedCookie}`);
  } catch (logError) {
    console.error("Failed to write linux.do cookie log.", logError);
  }
}

export async function logLinuxDoCookieError(context: string, reason: unknown) {
  const detail = reason instanceof Error ? reason.message : String(reason);

  try {
    await error(`[${LINUXDO_LOG_SOURCE}] ${context}: ${detail}`);
  } catch (logError) {
    console.error("Failed to write linux.do error log.", logError);
  }
}

export async function logLinuxDoHttpError(context: string, url: string, status: number, body: string) {
  const normalizedBody = body.trim() || "<empty body>";

  try {
    await error(`[${LINUXDO_LOG_SOURCE}] ${context} failed: url=${url} status=${status} body=${normalizedBody}`);
  } catch (logError) {
    console.error("Failed to write linux.do HTTP error log.", logError);
  }
}
