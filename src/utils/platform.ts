import { invoke } from "@tauri-apps/api/core";

export type PlatformCapabilities = {
  isMobile: boolean;
  supportsMultiWindow: boolean;
  supportsWindowResize: boolean;
};

type PlatformCapabilitiesRaw = {
  is_mobile?: boolean;
  supports_multi_window?: boolean;
  supports_window_resize?: boolean;
};

function detectMobileFromUA() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent.toLowerCase();
  return /android|iphone|ipad|ipod|mobile/.test(ua);
}

let cachedCapabilities: PlatformCapabilities = {
  isMobile: detectMobileFromUA(),
  supportsMultiWindow: !detectMobileFromUA(),
  supportsWindowResize: !detectMobileFromUA(),
};

export function getPlatformCapabilities() {
  return cachedCapabilities;
}

export async function initPlatformCapabilities() {
  try {
    const raw = await invoke<PlatformCapabilitiesRaw>("platform_capabilities");
    cachedCapabilities = {
      isMobile: Boolean(raw.is_mobile),
      supportsMultiWindow: Boolean(raw.supports_multi_window),
      supportsWindowResize: Boolean(raw.supports_window_resize),
    };
  } catch {
    // Keep UA-based fallback when command is unavailable.
  }
  return cachedCapabilities;
}
