import type { Platform } from "@/components/PlatformIcon";

export type TaskStatus = "available" | "pending" | "verified";

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

export const TASKS: Task[] = [
  {
    id: "tg-join-alpha",
    platform: "telegram",
    title: "Join the Alpha Signals channel",
    advertiser: "Alpha Signals",
    reward: 0.42,
    seconds: 30,
    status: "available",
    slotsLeft: 184,
    steps: ["Open the channel", "Tap Join", "Stay joined for 7 days"],
    proof: "auto",
  },
  {
    id: "yt-watch-launch",
    platform: "youtube",
    title: "Watch & like the launch video",
    advertiser: "Nova Wallet",
    reward: 0.85,
    seconds: 90,
    status: "available",
    slotsLeft: 62,
    steps: ["Watch at least 60 seconds", "Like the video", "Return and submit"],
    proof: "screenshot",
  },
  {
    id: "x-follow-core",
    platform: "x",
    title: "Follow @taskora and repost the pinned post",
    advertiser: "TASKORA",
    reward: 0.55,
    seconds: 45,
    status: "pending",
    slotsLeft: 310,
    steps: ["Follow the account", "Repost the pinned post", "Enter your handle"],
    proof: "username",
  },
  {
    id: "wa-join-community",
    platform: "whatsapp",
    title: "Join the merchant community group",
    advertiser: "PayLink Africa",
    reward: 0.6,
    seconds: 40,
    status: "available",
    slotsLeft: 45,
    steps: ["Open the invite link", "Join the group", "Send the join code"],
    proof: "screenshot",
  },
  {
    id: "tt-follow-creator",
    platform: "tiktok",
    title: "Follow the creator account",
    advertiser: "Loop Studio",
    reward: 0.38,
    seconds: 25,
    status: "verified",
    slotsLeft: 0,
    steps: ["Open the profile", "Tap Follow", "Enter your username"],
    proof: "username",
  },
  {
    id: "dc-join-server",
    platform: "discord",
    title: "Join the community server",
    advertiser: "Zenith Labs",
    reward: 0.7,
    seconds: 60,
    status: "available",
    slotsLeft: 128,
    steps: ["Open the invite", "Verify in #welcome", "Submit your Discord tag"],
    proof: "username",
  },
  {
    id: "ig-follow-brand",
    platform: "instagram",
    title: "Follow and save the brand post",
    advertiser: "Aurum Wear",
    reward: 0.5,
    seconds: 35,
    status: "available",
    slotsLeft: 91,
    steps: ["Follow the page", "Save the pinned post", "Upload a screenshot"],
    proof: "screenshot",
  },
];

export const CATEGORIES: { key: "all" | Platform; label: string }[] = [
  { key: "all", label: "All" },
  { key: "telegram", label: "Telegram" },
  { key: "youtube", label: "YouTube" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "x", label: "X" },
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "discord", label: "Discord" },
];

export type LedgerEntry = {
  id: string;
  label: string;
  amount: number;
  date: string;
  kind: "reward" | "referral" | "withdrawal" | "bonus";
};

export const LEDGER: LedgerEntry[] = [
  { id: "l1", label: "Verified — Alpha Signals", amount: 0.42, date: "Today, 14:02", kind: "reward" },
  { id: "l2", label: "Referral bonus — @maya", amount: 0.25, date: "Today, 11:20", kind: "referral" },
  { id: "l3", label: "Daily check-in — day 6", amount: 0.1, date: "Today, 08:04", kind: "bonus" },
  { id: "l4", label: "Withdrawal — USDT TRC20", amount: -12.0, date: "Yesterday", kind: "withdrawal" },
  { id: "l5", label: "Verified — Nova Wallet", amount: 0.85, date: "Yesterday", kind: "reward" },
];

export const USER = {
  name: "Daniel",
  handle: "@dannyy",
  level: "Gold Tasker",
  balance: 24.86,
  pending: 1.97,
  lifetime: 189.4,
  streak: 6,
  verifiedTasks: 214,
  referrals: 18,
  referralCode: "TASKORA-DNY500",
};

export const ACHIEVEMENTS = [
  { id: "a1", name: "First Verified", detail: "Complete your first task", done: true },
  { id: "a2", name: "Week Streak", detail: "7 days of check-ins", done: false },
  { id: "a3", name: "Century", detail: "100 verified tasks", done: true },
  { id: "a4", name: "Ambassador", detail: "Refer 25 taskers", done: false },
];
