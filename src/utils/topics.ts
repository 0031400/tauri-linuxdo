import type { TopicItem, TopicTag, TopicUser } from "../types/topic";

export const BASE_URL = "https://linux.do";

export function getTopicTitle(topic: TopicItem) {
  return stripHtml(topic.fancy_title || topic.title || `Topic #${topic.id}`);
}

export function getTopicUrl(topic: TopicItem) {
  if (!topic.slug) {
    return `${BASE_URL}/t/${topic.id}`;
  }
  return `${BASE_URL}/t/${topic.slug}/${topic.id}`;
}

export function getTopicAuthor(topic: TopicItem, users: Record<number, TopicUser>) {
  const userId = topic.posters?.[0]?.user_id;
  if (!userId) return null;
  return users[userId] ?? null;
}

export function getTopicTagLabel(tag: TopicTag) {
  if (typeof tag === "string") {
    return tag;
  }

  return tag.name || tag.slug || String(tag.id ?? "");
}

export function getTopicTagKey(tag: TopicTag) {
  if (typeof tag === "string") {
    return tag;
  }

  return tag.slug || tag.name || String(tag.id ?? "");
}

export function buildAvatarUrl(template: string, size: number) {
  const resolved = template.replace(/\{size\}/g, String(size));
  if (resolved.startsWith("http://") || resolved.startsWith("https://")) {
    return resolved;
  }
  if (resolved.startsWith("//")) {
    return `https:${resolved}`;
  }
  return `${BASE_URL}${resolved}`;
}

export function stripHtml(input: string) {
  return input.replace(/<[^>]+>/g, "").trim();
}

export function formatRelativeTime(value?: string) {
  if (!value) return "未知";
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < hour) {
    return `${Math.max(1, Math.floor(diff / minute))} 分钟前`;
  }
  if (diff < day) {
    return `${Math.floor(diff / hour)} 小时前`;
  }
  if (diff < day * 7) {
    return `${Math.floor(diff / day)} 天前`;
  }

  return date.toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
}

export function formatAbsoluteTime(value?: string) {
  if (!value) return "未知";
  const date = new Date(value);
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
