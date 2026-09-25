/**
 * Game brand tiles for Play & Earn section (official-style colors).
 */
import type { CSSProperties } from "react";

export type GameId = "pubg" | "freefire" | "cod" | "mobilelegends" | "roblox" | "generic";

const GAMES: Record<
  GameId,
  { label: string; short: string; bg: string; accent: string }
> = {
  pubg: { label: "PUBG Mobile", short: "PUBG", bg: "#F2A900", accent: "#1a1a1a" },
  freefire: { label: "Free Fire", short: "FF", bg: "#FF6B00", accent: "#fff" },
  cod: { label: "Call of Duty", short: "COD", bg: "#1B5E20", accent: "#fff" },
  mobilelegends: { label: "Mobile Legends", short: "MLBB", bg: "#1565C0", accent: "#fff" },
  roblox: { label: "Roblox", short: "RBX", bg: "#E2231A", accent: "#fff" },
  generic: { label: "Games", short: "PLAY", bg: "#0ea5e9", accent: "#fff" },
};

export const FEATURED_GAMES: GameId[] = ["pubg", "freefire", "cod", "mobilelegends", "roblox"];

export function GameLogo({
  id,
  size = 44,
}: {
  id: GameId;
  size?: number;
}) {
  const g = GAMES[id] ?? GAMES.generic;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-2xl font-black shadow-md ring-1 ring-white/15"
      style={
        {
          width: size,
          height: size,
          background: g.bg,
          color: g.accent,
          fontSize: Math.max(9, Math.round(size * 0.22)),
          letterSpacing: "0.02em",
        } as CSSProperties
      }
      title={g.label}
      aria-label={g.label}
      role="img"
    >
      {g.short}
    </span>
  );
}

export function GameBrandRow({ size = 40 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
      {FEATURED_GAMES.map((id) => (
        <GameLogo key={id} id={id} size={size} />
      ))}
    </div>
  );
}
