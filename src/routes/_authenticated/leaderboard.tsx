import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Bell,
  ChevronRight,
  ClipboardCheck,
  Gamepad2,
  PlayCircle,
  Trophy,
  Users,
  WalletCards,
  Star,
  Info,
  Crown,
} from "lucide-react";
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

type Tab = "earners" | "taskers" | "gamers" | "referrers";

function RankPage() {
  const { rows, dash } = Route.useLoaderData();
  const [tab, setTab] = useState<Tab>("earners");

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

  const sorted = [...rows].sort((a, b) => {
    if (tab === "referrers") return b.referrals - a.referrals;
    if (tab === "taskers") return b.task_points - a.task_points;
    return b.task_points - a.task_points;
  });

  return (
    <main className="mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-[#030814] px-3.5 pb-28 pt-3 text-white">
      <header className="mb-4 flex items-center gap-2">
        <Link to="/home" className="rounded-full border border-white/10 p-2 text-slate-400">
          <ChevronRight className="size-4 rotate-180" />
        </Link>
        <img src={TASKORA_LOGO} alt="" className="size-9 rounded-full ring-2 ring-cyan-400/40" />
        <p
          className="flex-1 text-lg font-black tracking-[0.06em]"
          style={{
            background: "linear-gradient(90deg,#e0f2fe,#38bdf8,#2563eb)",
            WebkitBackgroundClip: "text",
            color: "transparent",
          }}
        >
          TASKORA
        </p>
        <Link to="/notifications" className="relative rounded-full border border-white/10 bg-[#0b1628] p-2">
          <Bell className="size-4 text-slate-300" />
        </Link>
      </header>

      <section className="mb-3.5 flex items-center gap-3">
        <div className="relative">
          {photo ? (
            <img src={photo} alt="" className="size-14 rounded-full object-cover ring-2 ring-amber-400/50" />
          ) : (
            <span className="flex size-14 items-center justify-center rounded-full bg-cyan-500/20 text-lg font-black ring-2 ring-amber-400/40">
              {name.charAt(0)}
            </span>
          )}
          <span className="absolute -bottom-1 -right-1 rounded-full bg-amber-400 px-1.5 py-0.5 text-[8px] font-black text-[#1a1200]">
            <Crown className="inline size-2.5" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-slate-400">Welcome Back,</p>
          <p className="truncate text-base font-black">
            {name} <span className="text-amber-300">👑</span>
          </p>
          <span className="mt-0.5 inline-flex rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-200">
            Level {levelNum}
          </span>
        </div>
        <Link
          to="/wallet"
          className="rounded-2xl border border-cyan-400/25 bg-[#0b1628] px-3 py-2 text-right"
        >
          <p className="flex items-center gap-1 text-[9px] font-semibold text-slate-400">
            <WalletCards className="size-3 text-cyan-300" /> USDT Balance
          </p>
          <p className="text-sm font-black text-white">{formatUsd(balance)}</p>
        </Link>
      </section>

      <section className="mb-3.5 grid grid-cols-5 gap-1.5">
        <Tile to="/tasks" label="Tasks" sub="Complete tasks" Icon={ClipboardCheck} color="text-sky-300" />
        <Tile to="/watch-earn" label="Watch" sub="Watch & Earn" Icon={PlayCircle} color="text-emerald-300" />
        <Tile to="/home" label="Games" sub="Play games" Icon={Gamepad2} color="text-violet-300" muted />
        <Tile to="/ambassador" label="Referral" sub="Invite friends" Icon={Users} color="text-amber-300" />
        <Tile to="/leaderboard" label="Rank" sub="Leaderboard" Icon={Trophy} color="text-cyan-300" active />
      </section>

      <section className="mb-3.5 flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-gradient-to-r from-[#1a1408] to-[#0c1524] p-3.5">
        <span className="inline-flex size-11 items-center justify-center rounded-full border border-amber-300/40 bg-amber-400/15 text-amber-200">
          <Star className="size-5 fill-amber-300 text-amber-300" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className="text-sm font-black">Task Points</p>
            <Info className="size-3 text-slate-500" />
          </div>
          <p className="text-[10px] text-slate-400">
            Earn task points from daily check-ins, referrals and other eligible activities.
          </p>
        </div>
        <div className="text-right">
          <p className="text-[9px] text-slate-500">Your Task Points</p>
          <p className="text-lg font-black text-amber-200">{taskPoints.toLocaleString()}</p>
        </div>
      </section>

      <section className="mb-3 overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-r from-[#1a1408] via-[#121a28] to-[#0c1524] p-3.5">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-12 items-center justify-center rounded-full border border-amber-300/40 bg-amber-400/15 text-amber-200">
            <Trophy className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">
              Top Earners <span className="text-slate-400">(USDT)</span>
            </p>
            <p className="text-[10px] text-slate-500">Highest Task Points on TASKORA · live ranks</p>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-bold text-slate-300">
            Live
          </span>
        </div>
      </section>

      <div className="mb-3 flex gap-1 overflow-x-auto rounded-2xl border border-white/8 bg-[#0b1628] p-1">
        {(
          [
            ["earners", "Top Earners"],
            ["taskers", "Top Taskers"],
            ["gamers", "Top Gamers"],
            ["referrers", "Top Referrers"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`shrink-0 rounded-xl px-3 py-2 text-[10px] font-bold transition ${
              tab === id ? "bg-sky-400 text-[#04101c]" : "text-slate-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#0b1628]">
        <div className="grid grid-cols-[28px_1fr_auto] gap-2 border-b border-white/5 px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-slate-500">
          <span>#</span>
          <span>User</span>
          <span className="text-right">{tab === "referrers" ? "Referrals" : "Task Points"}</span>
        </div>
        {sorted.length === 0 ? (
          <p className="p-5 text-center text-sm text-slate-400">No ranked users yet. Complete tasks to appear here.</p>
        ) : (
          sorted.slice(0, 25).map((row, i) => {
            const rank = i + 1;
            const medal =
              rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
            const value =
              tab === "referrers" ? row.referrals : row.task_points;
            return (
              <div
                key={row.user_id}
                className="grid grid-cols-[28px_1fr_auto] items-center gap-2 border-b border-white/5 px-3 py-2.5 last:border-0"
              >
                <span className="text-center text-xs font-black text-slate-400">
                  {medal ?? rank}
                </span>
                <div className="flex min-w-0 items-center gap-2">
                  {row.photo_url ? (
                    <img src={row.photo_url} alt="" className="size-8 rounded-full object-cover" />
                  ) : (
                    <span className="flex size-8 items-center justify-center rounded-full bg-cyan-500/15 text-[10px] font-bold text-cyan-200">
                      {row.display_name.charAt(0)}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold">{row.display_name}</p>
                    <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[8px] font-semibold text-slate-400">
                      Lv. {Math.max(1, Math.floor(row.task_points / 250) + 1)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-right">
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-emerald-500/15 text-[9px] font-black text-emerald-300">
                    T
                  </span>
                  <span className="text-xs font-black tabular-nums text-emerald-200">
                    {tab === "referrers" ? value : value.toLocaleString()}
                  </span>
                  <ChevronRight className="size-3 text-slate-600" />
                </div>
              </div>
            );
          })
        )}
      </div>

      <p className="mt-3 text-center text-[10px] text-slate-500">
        Ranks use real profile Task Points. USDT earnings board expands as ledger totals are exposed.
      </p>
    </main>
  );
}

function Tile({
  to,
  label,
  sub,
  Icon,
  color,
  active,
  muted,
}: {
  to: string;
  label: string;
  sub: string;
  Icon: typeof Trophy;
  color: string;
  active?: boolean;
  muted?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`flex flex-col items-center gap-1 rounded-2xl border px-1 py-2.5 text-center ${
        active
          ? "border-cyan-400/40 bg-cyan-500/10"
          : "border-blue-400/15 bg-[#0b1628]"
      } ${muted ? "opacity-80" : ""}`}
    >
      <span className={`inline-flex size-9 items-center justify-center rounded-full bg-white/5 ${color}`}>
        <Icon className="size-4" />
      </span>
      <p className="truncate text-[10px] font-black leading-tight">{label}</p>
      <p className="truncate text-[8px] text-slate-500">{sub}</p>
    </Link>
  );
}
