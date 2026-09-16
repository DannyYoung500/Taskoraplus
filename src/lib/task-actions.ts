import type { Platform } from "@/components/PlatformIcon";

export type TaskAction =
  | "watch"
  | "follow"
  | "like"
  | "comment"
  | "repost"
  | "subscribe"
  | "join"
  | "review"
  | "visit"
  | "signup"
  | "vote"
  | "save"
  | "play"
  | "view";

const PLATFORM_ACTIONS: Record<Platform, readonly TaskAction[]> = {
  telegram: ["join", "follow", "watch", "like", "comment"],
  youtube: ["watch", "subscribe", "like", "comment"],
  whatsapp: ["join", "follow", "watch"],
  x: ["follow", "like", "repost", "comment", "watch"],
  instagram: ["follow", "like", "comment", "watch"],
  tiktok: ["follow", "like", "comment", "watch"],
  discord: ["join", "follow", "watch"],
  facebook: ["follow", "like", "comment", "watch"],
  reddit: ["follow", "like", "comment", "watch"],
  linkedin: ["follow", "like", "comment", "watch"],
  twitch: ["follow", "watch", "comment"],
  threads: ["follow", "like", "repost", "comment", "watch"],
  spotify: ["play", "follow", "like", "watch"],
  soundcloud: ["play", "follow", "like", "watch"],
  audiomack: ["play", "follow", "like", "watch"],
  pinterest: ["follow", "like", "save", "watch"],
  google: ["review", "watch"],
  website: ["visit", "signup", "watch"],
  survey: ["vote", "signup", "watch"],
  app_review: ["review", "watch"],
};

const LEGACY_ACTIONS: Record<string, TaskAction> = {
  view: "watch",
  views: "watch",
  follower: "follow",
  followers: "follow",
  subscribers: "subscribe",
  member: "join",
  members: "join",
  reposts: "repost",
  saves: "save",
  plays: "play",
  traffic: "visit",
  signup: "signup",
  signups: "signup",
  votes: "vote",
};

export function normalizeTaskAction(value: unknown): TaskAction | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
  const direct = normalized as TaskAction;
  if (
    [
      "watch",
      "follow",
      "like",
      "comment",
      "repost",
      "subscribe",
      "join",
      "review",
      "visit",
      "signup",
      "vote",
      "save",
      "play",
      "view",
    ].includes(direct)
  ) {
    return direct === "view" ? "watch" : direct;
  }
  return LEGACY_ACTIONS[normalized] ?? null;
}

export function isTaskActionAllowed(platform: Platform, action: unknown): boolean {
  const normalized = normalizeTaskAction(action);
  return normalized ? PLATFORM_ACTIONS[platform]?.includes(normalized) ?? false : false;
}

export function taskActionLabel(action: unknown): string {
  const normalized = normalizeTaskAction(action);
  if (!normalized) return "Task";
  const labels: Record<TaskAction, string> = {
    watch: "Watch",
    follow: "Follow",
    like: "Like",
    comment: "Comment",
    repost: "Repost",
    subscribe: "Subscribe",
    join: "Join",
    review: "Review",
    visit: "Visit",
    signup: "Sign up",
    vote: "Vote",
    save: "Save",
    play: "Play",
    view: "Watch",
  };
  return labels[normalized];
}

export function extractYouTubeVideoId(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (parsed.hostname === "youtu.be") return parsed.pathname.slice(1).split("/")[0] || null;
    if (parsed.hostname.endsWith("youtube.com")) {
      if (parsed.pathname === "/watch") return parsed.searchParams.get("v");
      if (parsed.pathname.startsWith("/shorts/")) return parsed.pathname.split("/")[2] ?? null;
      if (parsed.pathname.startsWith("/embed/")) return parsed.pathname.split("/")[2] ?? null;
    }
  } catch {
    return null;
  }
  return null;
}

export function extractTikTokVideoId(url: string): string | null {
  const match = url.match(/\/video\/(\d+)/i);
  return match?.[1] ?? null;
}

export function isDirectVideoUrl(url: string): boolean {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    return /\.(mp4|webm|ogg|mov|m4v)$/.test(pathname);
  } catch {
    return false;
  }
}

export function coveragePercent(watchedSeconds: Set<number>, duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  const totalSeconds = Math.max(1, Math.ceil(duration));
  let covered = 0;
  for (let second = 0; second < totalSeconds; second += 1) {
    if (watchedSeconds.has(second)) covered += 1;
  }
  return (covered / totalSeconds) * 100;
}
