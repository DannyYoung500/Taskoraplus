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
} from "react-icons/si";
import { FaLinkedin } from "react-icons/fa";
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
  | "twitch";

const MAP: Record<Platform, { Icon: IconType; color: string; label: string }> = {
  telegram: { Icon: SiTelegram, color: "#229ED9", label: "Telegram" },
  youtube: { Icon: SiYoutube, color: "#FF0000", label: "YouTube" },
  whatsapp: { Icon: SiWhatsapp, color: "#25D366", label: "WhatsApp" },
  x: { Icon: SiX, color: "#000000", label: "X" },
  instagram: { Icon: SiInstagram, color: "#E4405F", label: "Instagram" },
  tiktok: { Icon: SiTiktok, color: "#000000", label: "TikTok" },
  discord: { Icon: SiDiscord, color: "#5865F2", label: "Discord" },
  facebook: { Icon: SiFacebook, color: "#1877F2", label: "Facebook" },
  reddit: { Icon: SiReddit, color: "#FF4500", label: "Reddit" },
  linkedin: { Icon: FaLinkedin, color: "#0A66C2", label: "LinkedIn" },
  twitch: { Icon: SiTwitch, color: "#9146FF", label: "Twitch" },
};

export function platformLabel(p: Platform) {
  return MAP[p].label;
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
  const { Icon, color, label } = MAP[platform];
  return (
    <Icon size={size} color={color} className={className} aria-label={label} role="img" />
  );
}

export function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-2xl bg-secondary shadow-soft">
      <PlatformIcon platform={platform} size={22} />
    </span>
  );
}
