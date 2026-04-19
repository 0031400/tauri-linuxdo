import { useEffect, useState } from "react";
import { fetch } from "@tauri-apps/plugin-http";
import { buildAvatarUrl } from "../utils/topics";

const avatarObjectUrlCache = new Map<string, string>();
const avatarRequestCache = new Map<string, Promise<string>>();

async function loadAvatarObjectUrl(template: string, size: number) {
  const cacheKey = `${template}::${size}`;
  const cachedUrl = avatarObjectUrlCache.get(cacheKey);
  if (cachedUrl) {
    return cachedUrl;
  }

  const pendingRequest = avatarRequestCache.get(cacheKey);
  if (pendingRequest) {
    return pendingRequest;
  }

  const request = (async () => {
    const response = await fetch(buildAvatarUrl(template, size), {
      method: "GET",
    });

    if (!response.ok) {
      throw new Error(`Failed to load avatar: ${response.status}`);
    }

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    avatarObjectUrlCache.set(cacheKey, objectUrl);
    return objectUrl;
  })();

  avatarRequestCache.set(cacheKey, request);

  try {
    return await request;
  } finally {
    avatarRequestCache.delete(cacheKey);
  }
}

export function useAvatarSrc(template?: string, size = 64) {
  const [src, setSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!template) {
      setSrc(undefined);
      return;
    }

    let cancelled = false;
    const cacheKey = `${template}::${size}`;
    const cachedUrl = avatarObjectUrlCache.get(cacheKey);
    if (cachedUrl) {
      setSrc(cachedUrl);
      return;
    }

    setSrc(undefined);

    void loadAvatarObjectUrl(template, size)
      .then((objectUrl) => {
        if (!cancelled) {
          setSrc(objectUrl);
        }
      })
      .catch((error) => {
        console.error(error);
        if (!cancelled) {
          setSrc(undefined);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [size, template]);

  return src;
}
