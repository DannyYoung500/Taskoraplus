/**
 * Original TASKORA skill-game tiles (not third-party brands).
 */
import type { CSSProperties } from "react";

export type GameId = "tap" | "spin" | "quiz" | "rush" | "puzzle";

const GAMES: Record<
  GameId,
  { label: string; short: string; bg: string; accent: string }
> = {
  tap: { label: "Taskora Tap", short: "TAP", bg: "#0ea5e9", accent: "#fff" },
  spin: { label: "Taskora Spin", short: "SPIN", bg: "#6366f1", accent: "#fff" },
  quiz: { label: "Taskora Quiz", short: "QUIZ", bg: "#14b8a6", accent: "#fff" },
  rush: { label: "Taskora Rush", short: "RUSH", bg: "#3b82f6", accent: "#fff" },
  puzzle: { label: "Taskora Puzzle", short: "PUZ", bg: "#8b5cf6", accent: "#fff" },
};

export const FEATURED_GAMES: GameId[] = ["tap", "spin", "quiz", "rush", "puzzle"];

export function GameLogo({ id, size = 44 }: { id: GameId; size?: number }) {
  const g = GAMES[id] ?? GAMES.tap;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-2xl font-black shadow-md ring-1 ring-white/15"
      style={
        {
          width: size,
          height: size,
          background: g.bg,
          color: g.accent,
          fontSize: Math.max(9, Math.round(size * 0.2)),
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
