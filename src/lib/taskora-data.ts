import type { Platform } from "@/components/PlatformIcon";

/** Shared UI types only — no demo tasks, ledger, or fake user. */

export type TaskStatus = "available" | "pending" | "verified" | "rejected";

export type Task = {
  id: string;
  platform: Platform;
  title: string;
  advertiser: string;
  reward: number;
  seconds: number;
  status: TaskStatus;
  slotsLeft: number;
  steps: string[];
  proof: "auto" | "screenshot" | "username";
};

/** Task marketplace filters (Telegram campaigns still allowed; not used as "connected account"). */
export const CATEGORIES: { key: "all" | Platform; label: string }[] = [
  { key: "all", label: "All" },
  { key: "youtube", label: "YouTube" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "x", label: "X" },
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "discord", label: "Discord" },
  { key: "facebook", label: "Facebook" },
  { key: "reddit", label: "Reddit" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "twitch", label: "Twitch" },
  { key: "telegram", label: "Channels" },
];

/** Social accounts users can link (Telegram omitted — already identity). */
export const CONNECTABLE_PLATFORMS: Platform[] = [
  "youtube",
  "x",
  "tiktok",
  "instagram",
  "whatsapp",
  "discord",
  "facebook",
  "reddit",
  "linkedin",
  "twitch",
];
