import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { Crown, Medal, Trophy, RefreshCw } from "lucide-react";
import { getLeaderboard, type LeaderboardRow } from "@/lib/leaderboard.functions";
import { TASKORA_LOGO } from "@/lib/brand";
import { Screen } from "@/components/Screen";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  loader: async () => {
    try {
      const rows = await getLeaderboard();
      return { rows, error: null as string | null };
    } catch (e) {
      return {
        rows: [] as LeaderboardRow[],
        error: e instanceof Error ? e.message : "Unavailable",
      };
    }
  },
  component: LeaderboardPage,
});

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return name.slice(0, 2).toUpperCase() || "?";
}

function Avatar({
  row,
  size = "md",
  ring,
}: {
  row: LeaderboardRow;
  size?: "sm" | "md" | "lg";
  ring?: string;
}) {
  const dim = size === "lg" ? "size-16" : size === "md" ? "size-12" : "size-10";
  const text = size === "lg" ? "text-lg" : "text-sm";
  if (row.photo_url) {
    return (
      <img
        src={row.photo_url}
        alt=""
        className={`${dim} shrink-0 rounded-full object-cover ${ring ?? "ring-2 ring-white/20"}`}
        onError={(e) => {
          (e.target as HTMLImageElement).style.display = "none";
        }}
      />
    );
  }
  return (
    <span
      className={`inline-flex ${dim} shrink-0 items-center justify-center rounded-full bg-sky-500/20 font-bold text-sky-200 ${text} ${ring ?? "ring-2 ring-white/10"}`}
    >
      {initials(row.display_name)}
    </span>
  );
}

function LeaderboardPage() {
  const initial = Route.useLoaderData();
  const [rows, setRows] = useState(initial.rows);
  const [error, setError] = useState(initial.error);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setRefreshing(true);
    try {
      const next = await getLeaderboard();
      setRows(next);
      setError(null);
      setLastUpdated(new Date());
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "Unavailable");
    } finally {
      setRefreshing(false);
    }
  }, []);

  // Real-time-ish: poll every 45s while page is open
  useEffect(() => {
    const id = setInterval(() => void refresh(true), 45_000);
    return () => clearInterval(id);
  }, [refresh]);

  const first = rows[0] ?? null;
  const second = rows[1] ?? null;
  const third = rows[2] ?? null;
  const rest = rows.slice(3);

  return (
    <Screen className="!bg-[#0b1424]">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <img src={TASKORA_LOGO} alt="TASKORA" className="size-9 rounded-full object-cover ring-2 ring-sky-400/30" />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold tracking-tight">Leaderboard</h1>
          <p className="text-[11px] text-white/45">
            Top Task Points · non-withdrawable · updates every 45s
          </p>
        </div>
        <button
          type="button"
          onClick={() => void refresh(false)}
          disabled={refreshing}
          className="inline-flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-sky-300 active:scale-95 disabled:opacity-50"
          aria-label="Refresh leaderboard"
        >
          <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error ? (
        <p className="mb-3 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200/90">
          {error}
        </p>
      ) : null}

      <p className="mb-3 text-[10px] text-white/30">
        Last updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
      </p>

      {rows.length === 0 ? (
        <div className="rounded-3xl border border-white/10 bg-[#121f33] p-8 text-center text-sm text-white/45">
          No rankings yet. Earn Task Points to climb the board.
        </div>
      ) : (
        <>
          {/* Podium — top 3 */}
          <div className="relative mb-5 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#1a2a42] to-[#121f33] px-3 pb-5 pt-6">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(59,130,246,0.18),transparent_55%)]" />

            <div className="relative flex items-end justify-center gap-2">
              <PodiumSlot
                row={second}
                place={2}
                height="h-24"
                badge="bg-slate-400 text-slate-900"
                ring="ring-2 ring-slate-300/50"
              />
              <PodiumSlot
                row={first}
                place={1}
                height="h-32"
                badge="bg-amber-400 text-amber-950"
                ring="ring-2 ring-amber-300/60"
                crown
              />
              <PodiumSlot
                row={third}
                place={3}
                height="h-20"
                badge="bg-orange-400/90 text-orange-950"
                ring="ring-2 ring-orange-300/40"
              />
            </div>
          </div>

          <div className="space-y-2">
            {rest.map((r) => (
              <div
                key={r.user_id}
                className="flex items-center gap-3 rounded-2xl border border-white/8 bg-[#121f33] px-3 py-2.5"
              >
                <span className="w-6 text-center text-xs font-bold tabular-nums text-white/40">
                  {r.rank}
                </span>
                <Avatar row={r} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{r.display_name}</p>
                  <p className="text-[10px] text-white/40">
                    {r.referrals > 0 ? `${r.referrals} referrals` : r.username ? `@${r.username}` : "Tasker"}
                  </p>
                </div>
                <span className="text-sm font-bold tabular-nums text-emerald-300">
                  {r.task_points.toLocaleString()} pts
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </Screen>
  );
}

function formatUsdt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k USDT`;
  return `${n.toFixed(2)} USDT`;
}

function PodiumSlot({
  row,
  place,
  height,
  badge,
  ring,
  crown,
}: {
  row: LeaderboardRow | null;
  place: 1 | 2 | 3;
  height: string;
  badge: string;
  ring: string;
  crown?: boolean;
}) {
  if (!row) {
    return (
      <div className="flex w-[30%] flex-col items-center opacity-30">
        <div className={`w-full ${height} rounded-t-2xl bg-white/5`} />
      </div>
    );
  }

  const Icon = place === 1 ? Crown : place === 2 ? Medal : Trophy;

  return (
    <div className="flex w-[30%] flex-col items-center">
      <div className="relative mb-2">
        {crown ? (
          <Crown className="absolute -top-5 left-1/2 size-5 -translate-x-1/2 text-amber-300" />
        ) : null}
        <Avatar row={row} size={place === 1 ? "lg" : "md"} ring={ring} />
        <span
          className={`absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full text-[10px] font-extrabold ${badge}`}
        >
          {place}
        </span>
      </div>
      <p className="max-w-full truncate px-1 text-center text-xs font-bold">{row.display_name}</p>
      <p className="mt-0.5 text-[10px] text-white/40">
        {row.referrals > 0 ? `${row.referrals} referrals` : "—"}
      </p>
      <p className="mt-1 text-xs font-extrabold text-emerald-300">{row.task_points.toLocaleString()} pts</p>
      <div
        className={`mt-2 flex w-full ${height} flex-col items-center justify-start rounded-t-2xl border border-white/10 bg-black/25 pt-2`}
      >
        <Icon className={`size-4 ${place === 1 ? "text-amber-300" : "text-white/40"}`} />
        <span className="mt-1 text-lg font-black tabular-nums text-white/80">{place}</span>
      </div>
    </div>
  );
}
