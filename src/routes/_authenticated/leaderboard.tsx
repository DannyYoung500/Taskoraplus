import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, ChevronRight, Trophy, Star, Info, Crown } from "lucide-react";
import { getDashboard } from "@/lib/taskora.functions";
import { getLeaderboard, type LeaderboardRow } from "@/lib/leaderboard.functions";
import { TASKORA_LOGO, BLUE_GRAD } from "@/lib/brand";
import { formatUsd } from "@/lib/taskora-display";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({ meta: [{ title: "Rank — TASKORA" }] }),
  loader: async () => {
    const [rows, dash] = await Promise.all([
      getLeaderboard().catch(() => [] as LeaderboardRow[]),
      getDashboard().catch(() => null),
    ]);
    return { rows, dash };
  },
  component: RankPage,
});

type Tab = "usdt" | "points" | "tasks" | "referrers";

function weekLabel() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const day = Math.floor((now.getTime() - start.getTime()) / 86_400_000);
  const week = Math.ceil((day + start.getUTCDay() + 1) / 7);
  return `Season · Week ${week} · ${now.getUTCFullYear()}`;
}

function RankPage() {
  const { rows, dash } = Route.useLoaderData();
  const [tab, setTab] = useState<Tab>("usdt");

  const profile = dash?.profile as
    | {
        display_name?: string | null;
        photo_url?: string | null;
        task_points?: number;
        level_num?: number | null;
      }
    | null;

  const name = profile?.display_name ?? "Tasker";
  const photo = profile?.photo_url ?? null;
  const taskPoints = Number(profile?.task_points ?? 0);
  const levelNum = profile?.level_num ?? 1;

  const transactions = (dash?.transactions ?? []) as { amount: number | string }[];
  const balance = Math.max(
    0,
    transactions.reduce((s, t) => s + Number(t.amount), 0),
  );

  // Real ranking only — no invented users
  const sorted = [...rows]
    .filter((r) => {
      if (tab === "referrers") return r.referrals > 0;
      if (tab === "usdt") return Number(r.usdt_earned ?? 0) > 0;
      if (tab === "tasks") return Number(r.tasks_completed ?? 0) > 0;
      return r.task_points > 0;
    })
    .sort((a, b) => {
      if (tab === "referrers") return b.referrals - a.referrals;
      if (tab === "usdt") return Number(b.usdt_earned ?? 0) - Number(a.usdt_earned ?? 0);
      if (tab === "tasks") return Number(b.tasks_completed ?? 0) - Number(a.tasks_completed ?? 0);
      return b.task_points - a.task_points;
    });

  const myRank =
    sorted.findIndex((r) => r.display_name === name || r.user_id === (dash as { profile?: { id?: string } } | null)?.profile?.id) + 1;

  return (
    <main className="mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-[#030814] px-3.5 pb-28 pt-3 text-white">
      <header className="mb-4 flex items-center gap-2">
        <Link to="/home" className="rounded-full border border-white/10 p-2 text-slate-400">
          <ChevronRight className="size-4 rotate-180" />
        </Link>
        <img src={TASKORA_LOGO} alt="" className="size-9 rounded-full ring-2 ring-cyan-400/40" />
        <div className="min-w-0 flex-1">
          <p
            className="text-lg font-black tracking-[0.06em]"
            style={{
              background: "linear-gradient(90deg,#e0f2fe,#38bdf8,#2563eb)",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            Rank
          </p>
          <p className="text-[10px] text-slate-500">Live leaderboard · real data only</p>
        </div>
        <Link to="/home" className="rounded-full border border-white/10 bg-[#0b1628] p-2">
          <Bell className="size-4 text-slate-300" />
        </Link>
      </header>

      <section
        className="mb-3.5 overflow-hidden rounded-[22px] border border-cyan-400/30 p-4"
        style={{
          background:
            "radial-gradient(circle at 90% 10%,rgba(56,189,248,0.22),transparent 40%), linear-gradient(145deg,#0a1a33,#060f1c)",
        }}
      >
        <div className="flex items-center gap-3">
          {photo ? (
            <img src={photo} alt="" className="size-14 rounded-full object-cover ring-2 ring-amber-400/50" />
          ) : (
            <span className="flex size-14 items-center justify-center rounded-full bg-cyan-500/20 text-lg font-black ring-2 ring-amber-400/40">
              {name.charAt(0)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-slate-400">Your standing</p>
            <p className="truncate text-base font-black">
              {name}{" "}
              <Crown className="inline size-3.5 text-amber-300" />
            </p>
            <span className="mt-0.5 inline-flex rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-200">
              Level {levelNum}
              {myRank > 0 ? ` · #${myRank}` : ""}
            </span>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-semibold text-slate-400">USDT</p>
            <p className="text-sm font-black">{formatUsd(balance)}</p>
          </div>
        </div>
      </section>

      <section className="mb-3.5 flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-gradient-to-r from-[#1a1408] to-[#0c1524] p-3.5">
        <span className="inline-flex size-11 items-center justify-center rounded-full border border-amber-300/40 bg-amber-400/15 text-amber-200">
          <Star className="size-5 fill-amber-300 text-amber-300" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="text-sm font-black">Your Task Points</p>
            <Info className="size-3 text-slate-500" />
          </div>
          <p className="text-[10px] text-slate-400">From check-ins, referrals, and owner daily quests.</p>
        </div>
        <p className="text-xl font-black text-amber-200">{taskPoints.toLocaleString()}</p>
      </section>

      <section className="mb-3 overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-r from-[#1a1408] via-[#121a28] to-[#0c1524] p-3.5">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-12 items-center justify-center rounded-full border border-amber-300/40 bg-amber-400/15 text-amber-200">
            <Trophy className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">Leaderboard</p>
            <p className="text-[10px] text-slate-500">{weekLabel()} · real profiles only</p>
          </div>
          <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-200">
            Live
          </span>
        </div>
      </section>

      <div className="mb-3 flex gap-1 rounded-2xl border border-white/8 bg-[#0b1628] p-1">
        {(
          [
            ["usdt", "USDT"],
            ["points", "Points"],
            ["tasks", "Tasks"],
            ["referrers", "Invites"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 rounded-xl px-1.5 py-2.5 text-[10px] font-bold transition ${
              tab === id ? "text-[#04101c]" : "text-slate-400"
            }`}
            style={tab === id ? { background: BLUE_GRAD } : undefined}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#0b1628]">
        <div className="grid grid-cols-[32px_1fr_auto] gap-2 border-b border-white/5 px-3.5 py-2.5 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
          <span>#</span>
          <span>User</span>
          <span className="text-right">
            {tab === "referrers" ? "Invites" : tab === "usdt" ? "USDT" : tab === "tasks" ? "Tasks" : "Task Points"}
          </span>
        </div>
        {sorted.length === 0 ? (
          <div className="p-8 text-center">
            <Trophy className="mx-auto size-8 text-slate-600" />
            <p className="mt-3 text-sm font-bold text-slate-300">No ranked users yet</p>
            <p className="mt-1 text-[12px] text-slate-500">
              Complete verified tasks and earn USDT / Task Points to appear here.
            </p>
          </div>
        ) : (
          sorted.slice(0, 50).map((row, i) => {
            const rank = i + 1;
            const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
            const value =
              tab === "referrers"
                ? row.referrals
                : tab === "usdt"
                  ? Number(row.usdt_earned ?? 0)
                  : tab === "tasks"
                    ? Number(row.tasks_completed ?? 0)
                    : row.task_points;
            return (
              <div
                key={row.user_id}
                className="grid grid-cols-[32px_1fr_auto] items-center gap-2 border-b border-white/5 px-3.5 py-3 last:border-0"
              >
                <span className="text-center text-sm font-black text-slate-400">{medal ?? rank}</span>
                <div className="flex min-w-0 items-center gap-2.5">
                  {row.photo_url ? (
                    <img src={row.photo_url} alt="" className="size-9 rounded-full object-cover ring-1 ring-white/10" />
                  ) : (
                    <span className="flex size-9 items-center justify-center rounded-full bg-cyan-500/15 text-[11px] font-bold text-cyan-200">
                      {row.display_name.charAt(0)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-bold">{row.display_name}</p>
                    <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[8px] font-semibold text-slate-400">
                      Lv. {Math.max(1, Math.floor(row.task_points / 250) + 1)}
                    </span>
                  </div>
                </div>
                <span className="text-sm font-black tabular-nums text-cyan-200">
                  {tab === "usdt" ? formatUsd(Number(value)) : Number(value).toLocaleString()}
                </span>
              </div>
            );
          })
        )}
      </div>

      <p className="mt-3 text-center text-[10px] text-slate-500">
        Real ranks only · verified tasks · USDT ledger · no demo users.
      </p>
    </main>
  );
}
