import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ComponentType } from "react";
import {
  Bell,
  ChevronRight,
  ClipboardCheck,
  Crown,
  Megaphone,
  PlayCircle,
  Trophy,
  Users,
  WalletCards,
} from "lucide-react";
import { getDashboard } from "@/lib/taskora.functions";
import { TASKORA_LOGO, BLUE_GRAD } from "@/lib/brand";
import { formatUsd, isDemoTransactionLabel } from "@/lib/taskora-display";
import { PlatformLogo, type Platform } from "@/components/PlatformIcon";
import { AppLink } from "@/components/AppLink";

export const Route = createFileRoute("/_authenticated/home")({
  loader: async () => {
    const dash = await getDashboard().catch(() => null);
    return { dash };
  },
  head: () => ({ meta: [{ title: "Home — TASKORA" }] }),
  component: HomeScreen,
});

function HomeScreen() {
  const { dash } = Route.useLoaderData();
  const profile = dash?.profile as
    | {
        display_name?: string | null;
        username?: string | null;
        level?: string | null;
        level_num?: number | null;
        streak?: number | null;
        photo_url?: string | null;
        task_points?: number | null;
      }
    | null
    | undefined;

  const name = profile?.display_name ?? "Tasker";
  const handle = profile?.username ? `@${profile.username}` : "Telegram user";
  const levelNum = profile?.level_num ?? 1;
  const photo = profile?.photo_url ?? null;
  const isOwner = Boolean(dash?.isOwner);

  const txs = (dash?.transactions ?? []).filter((tx) => !isDemoTransactionLabel(tx.label));
  const balance = Math.max(
    0,
    txs.reduce((s, t) => s + Number(t.amount), 0),
  );

  const missions = (dash?.missions ?? []) as Array<{
    id: string;
    title: string;
    reward: string;
    progress: string;
    pct: number;
  }>;

  const tasks = (dash?.tasks ?? []) as Array<{
    id: string;
    title: string;
    reward: number | string;
    platform?: string;
    status?: string;
  }>;

  return (
    <main className="mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-[#030814] px-3.5 pb-28 pt-3 text-white">
      <header className="mb-4 flex items-center gap-2.5">
        <img
          src={TASKORA_LOGO}
          alt=""
          className="tk-logo pointer-events-none size-10 rounded-full ring-2 ring-cyan-400/40"
          onContextMenu={(e) => e.preventDefault()}
          draggable={false}
        />
        <div className="min-w-0 flex-1">
          <p
            className="text-lg font-black tracking-[0.06em]"
            style={{
              background: "linear-gradient(90deg,#e0f2fe,#38bdf8,#2563eb)",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            TASKORA
          </p>
          <p className="truncate text-[10px] text-slate-500">
            {name} · {handle}
          </p>
        </div>
        <AppLink
          to="/notifications"
          className="rounded-full border border-white/10 bg-[#0b1628] p-2.5"
          aria-label="Notifications"
        >
          <Bell className="size-4 text-slate-300" />
        </AppLink>
        <AppLink
          to="/profile"
          className="overflow-hidden rounded-full ring-1 ring-white/10"
          aria-label="Profile"
        >
          {photo ? (
            <img src={photo} alt="" className="size-9 object-cover" draggable={false} />
          ) : (
            <span className="flex size-9 items-center justify-center bg-cyan-500/15 text-xs font-black text-cyan-200">
              {name.charAt(0)}
            </span>
          )}
        </AppLink>
      </header>

      {isOwner ? (
        <AppLink
          to="/owner"
          className="mb-3 flex items-center gap-2 rounded-2xl border border-cyan-400/25 bg-cyan-500/10 px-3.5 py-2.5"
        >
          <Crown className="size-4 text-cyan-200" />
          <span className="flex-1 text-xs font-bold text-cyan-100">Owner Command Center</span>
          <ChevronRight className="size-4 text-cyan-300/70" />
        </AppLink>
      ) : null}

      <section
        className="mb-3.5 overflow-hidden rounded-[22px] border border-cyan-400/30 p-4"
        style={{
          background:
            "radial-gradient(circle at 90% 10%,rgba(56,189,248,0.22),transparent 40%), linear-gradient(145deg,#0a1a33,#060f1c)",
        }}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300/70">
          Available balance
        </p>
        <p className="mt-1 text-3xl font-extrabold tracking-tight tabular-nums">{formatUsd(balance)}</p>
        <p className="mt-1 text-[10px] text-slate-400">No deposit required to start earning</p>
        <AppLink
          to="/wallet"
          className="mt-3 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[11px] font-medium text-white shadow-[0_6px_20px_rgba(37,99,235,0.28)]"
          style={{ background: BLUE_GRAD }}
        >
          <WalletCards className="size-3.5" />
          Withdraw
          <ChevronRight className="size-3.5" />
        </AppLink>
      </section>

      <section className="mb-3.5">
        <div className="grid grid-cols-5 gap-1.5">
          <Quick to="/tasks" label="Tasks" Icon={ClipboardCheck} />
          <Quick to="/watch-earn" label="Watch" Icon={PlayCircle} />
          <Quick to="/advertise" label="Advertise" Icon={Megaphone} />
          <Quick to="/leaderboard" label="Rank" Icon={Trophy} />
          <Quick to="/ambassador" label="Invite" Icon={Users} />
        </div>
      </section>

      <section className="mb-3.5 overflow-hidden rounded-[20px] border border-cyan-400/20 bg-[#0b1628] p-3.5">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-400/10 text-cyan-200">
            <Trophy className="size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Level {levelNum}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">Keep completing activities to reach the next level.</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold text-slate-400">Progress</p>
            <p className="text-sm font-black text-cyan-200">{Math.min(99, levelNum * 12)}%</p>
          </div>
        </div>
      </section>

      <section className="mb-3.5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-black">Daily missions</p>
          <AppLink to="/daily-missions" className="text-[11px] font-bold text-cyan-300">View All →</AppLink>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {missions.slice(0, 3).map((m) => (
            <AppLink key={m.id} to="/daily-missions" className="rounded-2xl border border-blue-400/15 bg-[#0b1628] p-2.5 active:scale-[0.98]">
              <p className="text-[11px] font-bold leading-tight">{m.title}</p>
              <p className="mt-0.5 text-[10px] font-black text-cyan-300">{m.reward}</p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.min(100, Number(m.pct) || 0)}%` }} />
              </div>
              <p className="mt-1 text-[9px] text-slate-500">{m.progress}</p>
            </AppLink>
          ))}
          {missions.length === 0 ? (
            <AppLink to="/daily-missions" className="col-span-3 rounded-2xl border border-white/8 bg-[#0b1628] p-4 text-center text-[11px] text-slate-500">
              No missions today · check back later
            </AppLink>
          ) : null}
        </div>
      </section>

      <section className="mb-3.5">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-black">Open tasks</p>
          <AppLink to="/tasks" className="text-[11px] font-bold text-cyan-300">
            See all →
          </AppLink>
        </div>
        <div className="space-y-2">
          {tasks.slice(0, 5).map((t) => (
            <AppLink
              key={t.id}
              to="/tasks/$taskId"
              params={{ taskId: t.id }}
              className="flex items-center gap-3 rounded-2xl border border-blue-400/15 bg-[#0b1628] p-3 active:scale-[0.99]"
            >
              <PlatformLogo platform={(t.platform as Platform) || "custom"} size={36} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{t.title}</p>
                <p className="text-[10px] text-slate-500">{t.platform || "Task"}</p>
              </div>
              <p className="text-sm font-black text-cyan-300">{formatUsd(Number(t.reward) || 0)}</p>
            </AppLink>
          ))}
          {tasks.length === 0 ? (
            <div className="rounded-2xl border border-white/8 bg-[#0b1628] p-5 text-center text-[12px] text-slate-500">
              No open tasks right now. Check Watch & Earn or come back later.
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function Quick({
  to,
  label,
  Icon,
  platform,
}: {
  to: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  platform?: Platform;
}) {
  return (
    <AppLink
      to={to}
      className="flex min-w-0 min-h-[68px] flex-col items-center justify-center rounded-[14px] border border-blue-400/15 bg-[#0b1628]/80 px-1 py-2 text-center shadow-[0_4px_14px_rgba(15,23,42,0.16)] active:scale-[0.98]"
    >
      {platform ? (
        <PlatformLogo platform={platform} size={40} />
      ) : (
        <span className="inline-flex size-7 items-center justify-center rounded-lg bg-blue-500/10 text-cyan-300">
          <Icon className="size-5" />
        </span>
      )}
      <p className="mt-1 w-full truncate text-[9px] font-medium leading-tight text-slate-300">{label}</p>
    </AppLink>
  );
}

function DailyCard({
  to,
  title,
  reward,
  progress,
  pct,
  Icon,
}: {
  to: string;
  title: string;
  reward: string;
  progress: string;
  pct: number;
  Icon: ComponentType<{ className?: string }>;
}) {
  return (
    <AppLink to={to} className="rounded-2xl border border-blue-400/15 bg-[#0b1628] p-2.5 active:scale-[0.98]">
      <span className="inline-flex size-8 items-center justify-center rounded-full bg-blue-500/15 text-cyan-300">
        <Icon className="size-4" />
      </span>
      <p className="mt-2 text-[11px] font-bold leading-tight">{title}</p>
      <p className="mt-0.5 text-[10px] font-black text-cyan-300">{reward}</p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <p className="mt-1 text-[9px] text-slate-500">{progress}</p>
    </AppLink>
  );
}
