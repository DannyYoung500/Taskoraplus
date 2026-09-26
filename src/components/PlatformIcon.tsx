import {
  SiTelegram,
  SiYoutube,
  SiWhatsapp,
  SiX,
  SiInstagram,
  SiTiktok,
  SiDiscord,
  SiFacebook,
  SiReddit,
  SiTwitch,
  SiSpotify,
  SiSoundcloud,
  SiPinterest,
  SiThreads,
  SiGoogle,
  SiAudiomack,
} from "react-icons/si";
import { FaGlobe, FaPoll, FaAppStore, FaLinkedin } from "react-icons/fa";
import type { IconType } from "react-icons";

export type Platform =
  | "telegram"
  | "youtube"
  | "whatsapp"
  | "x"
  | "instagram"
  | "tiktok"
  | "discord"
  | "facebook"
  | "reddit"
  | "linkedin"
  | "twitch"
  | "threads"
  | "spotify"
  | "soundcloud"
  | "audiomack"
  | "pinterest"
  | "google"
  | "website"
  | "survey"
  | "app_review";

type PlatformMeta = {
  Icon: IconType;
  color: string;
  bg: string;
  label: string;
  category: "social" | "messaging" | "music" | "reviews" | "other";
  services: number;
  blurb: string;
};

export const PLATFORM_META: Record<Platform, PlatformMeta> = {
  instagram: {
    Icon: SiInstagram,
    color: "#E4405F",
    bg: "from-[#f58529] via-[#dd2a7b] to-[#8134af]",
    label: "Instagram",
    category: "social",
    services: 4,
    blurb: "Followers, likes, comments & video views",
  },
  youtube: {
    Icon: SiYoutube,
    color: "#FF0000",
    bg: "from-[#ff0000] to-[#cc0000]",
    label: "YouTube",
    category: "social",
    services: 4,
    blurb: "Subscribers, views, likes & comments",
  },
  tiktok: {
    Icon: SiTiktok,
    color: "#000000",
    bg: "from-[#25F4EE] via-[#000] to-[#FE2C55]",
    label: "TikTok",
    category: "social",
    services: 4,
    blurb: "Followers, likes, views & engagement",
  },
  x: {
    Icon: SiX,
    color: "#FFFFFF",
    bg: "from-[#1a1a1a] to-[#333]",
    label: "X",
    category: "social",
    services: 4,
    blurb: "Followers, likes, reposts & audience",
  },
  facebook: {
    Icon: SiFacebook,
    color: "#1877F2",
    bg: "from-[#1877F2] to-[#0d5bb5]",
    label: "Facebook",
    category: "social",
    services: 4,
    blurb: "Page likes, post likes, followers",
  },
  linkedin: {
    Icon: FaLinkedin,
    color: "#0A66C2",
    bg: "from-[#0A66C2] to-[#004182]",
    label: "LinkedIn",
    category: "social",
    services: 3,
    blurb: "Followers, post likes & engagement",
  },
  threads: {
    Icon: SiThreads,
    color: "#FFFFFF",
    bg: "from-[#1a1a1a] to-[#444]",
    label: "Threads",
    category: "social",
    services: 3,
    blurb: "Followers, likes & reposts",
  },
  telegram: {
    Icon: SiTelegram,
    color: "#229ED9",
    bg: "from-[#229ED9] to-[#1a7fb0]",
    label: "Telegram",
    category: "messaging",
    services: 4,
    blurb: "Members, views, reactions & bots",
  },
  whatsapp: {
    Icon: SiWhatsapp,
    color: "#25D366",
    bg: "from-[#25D366] to-[#128C7E]",
    label: "WhatsApp",
    category: "messaging",
    services: 2,
    blurb: "Channel members & engagement",
  },
  discord: {
    Icon: SiDiscord,
    color: "#5865F2",
    bg: "from-[#5865F2] to-[#404EED]",
    label: "Discord",
    category: "messaging",
    services: 3,
    blurb: "Members, reactions & boosts",
  },
  spotify: {
    Icon: SiSpotify,
    color: "#1DB954",
    bg: "from-[#1DB954] to-[#191414]",
    label: "Spotify",
    category: "music",
    services: 3,
    blurb: "Plays, followers & saves",
  },
  soundcloud: {
    Icon: SiSoundcloud,
    color: "#FF5500",
    bg: "from-[#FF5500] to-[#cc4400]",
    label: "SoundCloud",
    category: "music",
    services: 3,
    blurb: "Plays, likes & followers",
  },
  audiomack: {
    Icon: SiAudiomack,
    color: "#FFA200",
    bg: "from-[#FFA200] to-[#cc8200]",
    label: "Audiomack",
    category: "music",
    services: 2,
    blurb: "Plays & followers",
  },
  app_review: {
    Icon: FaAppStore,
    color: "#0D96F6",
    bg: "from-[#0D96F6] to-[#0070c9]",
    label: "App Review",
    category: "reviews",
    services: 2,
    blurb: "App Store & Play ratings",
  },
  google: {
    Icon: SiGoogle,
    color: "#4285F4",
    bg: "from-[#4285F4] to-[#34A853]",
    label: "Google",
    category: "reviews",
    services: 2,
    blurb: "Reviews & maps engagement",
  },
  website: {
    Icon: FaGlobe,
    color: "#3B82F6",
    bg: "from-[#3B82F6] to-[#1D4ED8]",
    label: "Website",
    category: "other",
    services: 2,
    blurb: "Visits & form completions",
  },
  survey: {
    Icon: FaPoll,
    color: "#8B5CF6",
    bg: "from-[#8B5CF6] to-[#6D28D9]",
    label: "Survey",
    category: "other",
    services: 2,
    blurb: "Completed survey responses",
  },
  pinterest: {
    Icon: SiPinterest,
    color: "#E60023",
    bg: "from-[#E60023] to-[#ad001a]",
    label: "Pinterest",
    category: "social",
    services: 3,
    blurb: "Followers, saves & engagement",
  },
  reddit: {
    Icon: SiReddit,
    color: "#FF4500",
    bg: "from-[#FF4500] to-[#cc3700]",
    label: "Reddit",
    category: "social",
    services: 3,
    blurb: "Upvotes, members & comments",
  },
  twitch: {
    Icon: SiTwitch,
    color: "#9146FF",
    bg: "from-[#9146FF] to-[#6441A5]",
    label: "Twitch",
    category: "social",
    services: 3,
    blurb: "Followers, views & chat engagement",
  },
};

export const PLATFORM_ORDER: Platform[] = [
  "instagram",
  "youtube",
  "tiktok",
  "x",
  "facebook",
  "linkedin",
  "threads",
  "telegram",
  "whatsapp",
  "discord",
  "spotify",
  "soundcloud",
  "audiomack",
  "app_review",
  "google",
  "website",
  "survey",
  "pinterest",
  "reddit",
  "twitch",
];

export const CATEGORY_LABELS: Record<PlatformMeta["category"], string> = {
  social: "Social Media",
  messaging: "Messaging",
  music: "Music & Audio",
  reviews: "Reviews & Apps",
  other: "Other",
};

export function platformLabel(p: Platform) {
  return PLATFORM_META[p]?.label ?? p;
}

export function PlatformIcon({
  platform,
  size = 20,
  className,
}: {
  platform: Platform;
  size?: number;
  className?: string;
}) {
  const meta = PLATFORM_META[platform];
  if (!meta) return null;
  const { Icon, color, label } = meta;
  return <Icon size={size} color={color} className={className} aria-label={label} role="img" />;
}

export function PlatformBadge({ platform, size = 48 }: { platform: Platform; size?: number }) {
  const meta = PLATFORM_META[platform];
  if (!meta) return null;
  const { Icon, color } = meta;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full shadow-lg ring-2 ring-white/10"
      style={{ width: size, height: size, backgroundColor: `${color}22` }}
    >
      <Icon size={Math.round(size * 0.48)} color={color} />
    </span>
  );
}

export function PlatformLogo({ platform, size = 52 }: { platform: Platform; size?: number }) {
  const meta = PLATFORM_META[platform];
  if (!meta) return null;
  const { Icon, color, label } = meta;
  const isDarkBrand = platform === "x" || platform === "threads" || platform === "tiktok";
  const solidBg =
    platform === "instagram"
      ? undefined
      : isDarkBrand
        ? "#111111"
        : color === "#FFFFFF"
          ? "#111111"
          : color;

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-2xl shadow-md ring-1 ring-white/10"
      style={{
        width: size,
        height: size,
        background:
          platform === "instagram"
            ? "linear-gradient(45deg,#f58529,#dd2a7b,#8134af)"
            : solidBg,
      }}
      title={label}
      aria-label={label}
    >
      <Icon size={Math.round(size * 0.46)} color="#fff" />
    </span>
  );
}
