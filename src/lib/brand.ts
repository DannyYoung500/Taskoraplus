/** TASKORA brand — warm multi-color (NEWTUBE-inspired, soft type) */
export const TASKORA_LOGO = "/file_00000000ed3c81f4aa87692163117fac.png";
export const TASKORA_WELCOME_IMAGE = "/file_00000000f77c81f4ba94c0467d0c7dec.png";

export const TASKORA_NAME = "TASKORA";
export const TASKORA_TAGLINE = "Earn · Watch · Grow";

/** Soft near-black surfaces — no heavy cyan borders */
export const COLORS = {
  bg: "#080808",
  surface: "#121212",
  surface2: "#1a1a1a",
  surface3: "#222222",
  border: "rgba(255,255,255,0.06)",
  /** Primary accent — warm orange like NEWTUBE earnings */
  accent: "#f97316",
  accentSoft: "#fb923c",
  accentMuted: "rgba(249,115,22,0.15)",
  /** Secondary multi-color accents */
  rose: "#fb7185",
  violet: "#a78bfa",
  emerald: "#34d399",
  sky: "#38bdf8",
  text: "#f5f5f5",
  textSoft: "#a3a3a3",
  muted: "#737373",
  menuActive: "#f97316",
  menuActiveText: "#0a0a0a",
} as const;

/** Soft orange gradient for CTAs */
export const ACCENT_GRAD = "linear-gradient(135deg, #fb923c, #f97316, #ea580c)";
/** Keep BLUE_GRAD as alias so old imports don't break — maps to warm accent */
export const BLUE_GRAD = ACCENT_GRAD;
export const GOLD_GRAD = ACCENT_GRAD;
