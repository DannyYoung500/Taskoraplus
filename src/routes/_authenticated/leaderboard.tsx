import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Bell, ChevronRight, Trophy, Crown } from "lucide-react";
import { getDashboard } from "@/lib/taskora.functions";
import { getLeaderboard, type LeaderboardRow } from "@/lib/leaderboard.functions";
import { TASKORA_LOGO, ACCENT_GRAD } from "@/lib/brand";
import { formatUsd } from "@/lib/taskora-display";
import { AppLink } from "@/components/AppLink";

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

type Tab = "usdt" | "tasks" | "referrers";

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
        id?: string;
      }
    | null;

  const name = profile?.display_name ?? "Tasker";
  const photo = profile?.photo_url ?? null;
  const levelNum = profile?.level_num ?? 1;

  const transactions = (dash?.transactions ?? []) as { amount: number | string }[];
  const balance = Math.max(
    0,
    transactions.reduce((s, t) => s + Number(t.amount), 0),
  );

  const sorted = [...rows]
    .filter((r) => {
      if (tab === "referrers") return r.referrals > 0;
      if (tab === "usdt") return Number(r.usdt_earned ?? 0) > 0;
      if (tab === "tasks") return Number(r.tasks_completed ?? 0) > 0;
      return true;
    })
    .sort((a, b) => {
      if (tab === "referrers") return b.referrals - a.referrals;
      if (tab === "usdt") return Number(b.usdt_earned ?? 0) - Number(a.usdt_earned ?? 0);
      if (tab === "tasks") return Number(b.tasks_completed ?? 0) - Number(a.tasks_completed ?? 0);
      return b.task_points - a.task_points;
    });

  const myRank =
    sorted.findIndex(
      (r) =>
        r.display_name === name ||
        r.user_id === profile?.id,
    ) + 1;

  const tabs: { id: Tab; label: string }[] = [
    { id: "usdt", label: "Earnings" },
    { id: "tasks", label: "Tasks" },
    { id: "referrers", label: "Referrals" },
  ];

  return (
    <main className="mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-[#080808] px-4 pb-28 pt-3 text-neutral-100">
      <header className="mb-4 flex items-center gap-2.5">
        <AppLink to="/home" className="p-2 text-neutral-500" aria-label="Back">
          <ChevronRight className="size-4 rotate-180" strokeWidth={1.75} />
        </AppLink>
        <img src={TASKORA_LOGO} alt="" className="size-9 rounded-full object-cover" draggable={false} />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-medium tracking-tight text-neutral-50">Rank</p>
          <p className="text-[11px] font-normal text-neutral-500">Live leaderboard · real data only</p>
        </div>
        <AppLink to="/notifications" className="p-2 text-neutral-400" aria-label="Notifications">
          <Bell className="size-4" strokeWidth={1.75} />
        </AppLink>
      </header>

      <section className="mb-3.5 rounded-2xl bg-[#121212] p-4">
        <div className="flex items-center gap-3">
          {photo ? (
            <img src={photo} alt="" className="size-14 rounded-full object-cover" draggable={false} />
          ) : (
            <span className="flex size-14 items-center justify-center rounded-full bg-neutral-800 text-lg font-medium text-neutral-300">
              {name.charAt(0)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-normal text-neutral-500">Your standing</p>
            <p className="truncate text-[15px] font-medium text-neutral-50">
              {name}{" "}
              <Crown className="inline size-3.5 text-orange-400" strokeWidth={1.75} />
            </p>
            <span className="mt-1 inline-flex rounded-md bg-orange-500/15 px-2 py-0.5 text-[10px] font-medium text-orange-400">
              Level {levelNum}
              {myRank > 0 ? ` · #${myRank}` : ""}
            </span>
          </div>
          <div className="text-right">
            <p className="text-[11px] text-neutral-500">Balance</p>
            <p className="text-sm font-medium text-orange-400">{formatUsd(balance)}</p>
          </div>
        </div>
        <p className="mt-3 text-[10px] font-normal text-neutral-600">{weekLabel()}</p>
      </section>

      <div className="mb-3 flex gap-1 rounded-2xl bg-[#121212] p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-xl py-2 text-[12px] font-medium transition ${
              tab === t.id
                ? "bg-orange-500/20 text-orange-400"
                : "text-neutral-500"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className="rounded-2xl bg-[#121212]">
        <div className="grid grid-cols-[32px_1fr_auto] gap-2 px-3.5 py-2.5 text-[9px] font-medium uppercase tracking-wider text-neutral-600">
          <span>#</span>
          <span>User</span>
          <span className="text-right">
            {tab === "usdt" ? "Earned" : tab === "tasks" ? "Tasks" : "Refs"}
          </span>
        </div>
        {sorted.length === 0 ? (
          <div className="px-3.5 py-10 text-center">
            <Trophy className="mx-auto size-8 text-neutral-700" strokeWidth={1.5} />
            <p className="mt-2 text-[13px] font-medium text-neutral-400">No rankings yet</p>
            <p className="mt-1 text-[11px] text-neutral-600">Complete tasks to appear here</p>
          </div>
        ) : (
          sorted.slice(0, 50).map((r, i) => {
            const isMe =
              r.display_name === name || r.user_id === profile?.id;
            const value =
              tab === "usdt"
                ? formatUsd(Number(r.usdt_earned ?? 0))
                : tab === "tasks"
                  ? String(r.tasks_completed ?? 0)
                  : String(r.referrals);
            return (
              <div
                key={r.user_id ?? i}
                className={`grid grid-cols-[32px_1fr_auto] items-center gap-2 px-3.5 py-3 ${
                  isMe ? "bg-orange-500/8" : ""
                }`}
              >
                <span
                  className={`text-[12px] font-medium ${
                    i < 3 ? "text-orange-400" : "text-neutral-500"
                  }`}
                >
                  {i + 1}
                </span>
                <div className="flex min-w-0 items-center gap-2">
                  {r.photo_url ? (
                    <img
                      src={r.photo_url}
                      alt=""
                      className="size-8 rounded-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    <span className="flex size-8 items-center justify-center rounded-full bg-neutral-800 text-[11px] font-medium text-neutral-400">
                      {(r.display_name ?? "?").charAt(0)}
                    </span>
                  )}
                  <span className={`truncate text-[13px] font-medium ${isMe ? "text-orange-300" : "text-neutral-200"}`}>
                    {r.display_name ?? "User"}
                    {isMe ? " · you" : ""}
                  </span>
                </div>
                <span
                  className="text-right text-[12px] font-medium"
                  style={i === 0 ? { color: "#f97316" } : undefined}
                >
                  {value}
                </span>
              </div>
            );
          })
        )}
      </section>

      <p className="mt-4 text-center text-[10px] font-normal text-neutral-600">
        Rankings update from verified activity only
      </p>
    </main>
  );
}
