/** Platform service catalog for Advertise — platform-matched only */
import type { Platform } from "@/components/PlatformIcon";

export type ServiceDef = {
  id: string;
  taskType: string;
  title: string;
  desc: string;
  fromUsd: number;
  unit: string;
  minQty: number;
  maxQty: number;
  qtyChips: number[];
  delivery: string;
  linkPlaceholder: string;
  suggestedTitles: string[];
  defaultSteps: string[];
  defaultWarning: string;
};

export const PLATFORM_FEE = 0.2;
export const FEATURE_FEE_USD = 5;

export const SERVICES: Record<Platform, ServiceDef[]> = {
  instagram: [
    {
      id: "ig_followers",
      taskType: "follow",
      title: "Instagram Followers",
      desc: "Real followers on your Instagram account",
      fromUsd: 0.08,
      unit: "followers",
      minQty: 50,
      maxQty: 10000,
      qtyChips: [50, 100, 250, 500, 1000, 5000],
      delivery: "~48h",
      linkPlaceholder: "https://www.instagram.com/yourusername",
      suggestedTitles: ["Follow this Instagram account", "Tap Follow on this Instagram profile"],
      defaultSteps: ["Open the Instagram profile link", "Tap Follow", "Take a screenshot of the followed profile", "Submit proof"],
      defaultWarning: "Real engagement only. Do not unfollow after submitting proof.",
    },
  ],
  youtube: [],
  tiktok: [],
  x: [],
  facebook: [],
  linkedin: [],
  threads: [],
  telegram: [],
  whatsapp: [],
  discord: [],
  spotify: [],
  soundcloud: [],
  audiomack: [],
  app_review: [],
  google: [],
  website: [],
  survey: [],
  pinterest: [],
  reddit: [],
  twitch: [],
};

export const QTY_UNIT_LABEL: Record<string, string> = {
  followers: "followers",
  likes: "likes",
  comments: "comments",
  views: "views",
  members: "members",
  subscribers: "subscribers",
  reposts: "reposts",
  plays: "plays",
  saves: "saves",
  reviews: "reviews",
  ratings: "ratings",
  visits: "visits",
  "sign-ups": "sign-ups",
  clicks: "clicks",
  responses: "responses",
  votes: "votes",
  upvotes: "upvotes",
  messages: "messages",
  actions: "actions",
  playlists: "playlists",
  package: "package",
};
