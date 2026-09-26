import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ComponentType } from "react";
import {
  ClipboardCheck,
  PlayCircle,
  Users,
  Bell,
  Megaphone,
  Crown,
  ChevronRight,
  CalendarCheck,
  WalletCards,
  Flame,
  Star,
  Trophy,
} from "lucide-react";
import { listTasks, getDashboard, dailyCheckin, syncMyTimezone } from "@/lib/taskora.functions";
import { PlatformLogo, platformLabel, type Platform } from "@/components/PlatformIcon";
import { TASKORA_LOGO, BLUE_GRAD } from "@/lib/brand";
import { formatUsd, isDemoTaskTitle, isDemoTransactionLabel } from "@/lib/taskora-display";

export const Route = createFileRoute("/_authenticated/home")({
  loader: async () => {
    const [tasks, dash] = await Promise.all([
      listTasks().catch(() => []),
      getDashboard().catch(() => null),
    ]);
    return {
      tasks: tasks.filter((task) => !isDemoTaskTitle(task.title)).slice(0, 8),
      dash,
    };
  },
  component: HomePage,
});

function levelFromPoints(points: number) {
  if (points >= 10000) return { num: 20, label: "Elite", next: 15000 };
  if (points >= 5000) return { num: 15, label: "Pro", next: 10000 };
  if (points >= 2500) return { num: 12, label: "Starter", next: 5000 };
  if (points >= 1000) return { num: 8, label: "Rising", next: 2500 };
  if (points >= 250) return { num: 4, label: "Rookie", next: 1000 };
  return { num: 1, label: "New", next: 250 };
}

function HomePage() {
  const { tasks, dash } = Route.useLoaderData();
  const transactions = (dash?.transactions ?? []).filter((tx) => !isDemoTransactionLabel(tx.label));
  const rawBalance = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const balance = rawBalance <= 0.00005 ? 0 : Math.max(0, rawBalance);
  const pending = (dash?.submissions ?? [])
    .filter((s) => s.status === "pending" && !isDemoTaskTitle(s.tasks?.title))
    .reduce((sum, s) => sum + Number(s.tasks?.reward ?? 0), 0);

  const profile = dash?.profile as
    | {
        display_name?: string | null;
        photo_url?: string | null;
        streak?: number;
        task_points?: number;
        level?: string | null;
        level_num?: number | null;
      }
    | null;

  const name = profile?.display_name ?? "Tasker";
  const photo = profile?.photo_url ?? null;
  const streak = profile?.streak ?? 0;
  const taskPoints = Number(profile?.task_points ?? 0);
  const lvl = levelFromPoints(taskPoints);
  const levelNum = profile?.level_num ?? lvl.num;
  const levelLabel = profile?.level ?? lvl.label;
  const nextTarget = lvl.next;
  const progressPct = Math.min(100, Math.round((taskPoints / nextTarget) * 100));
  const isOwner = Boolean(dash?.isOwner);

  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone) void syncMyTimezone({ data: { timezone } }).catch(() => {});
  }, []);

  const submissions = dash?.submissions ?? [];
  const doneTasks = submissions.filter((s) => s.status === "approved" || s.status === "pending").length;
  const taskProgress = Math.min(3, doneTasks);

  const [checkMsg, setCheckMsg] = useState<string | null>(null);
  const [displayTaskPoints, setDisplayTaskPoints] = useState(taskPoints);
  const [checkBusy, setCheckBusy] = useState(false);

  async function onCheckin() {
    setCheckBusy(true);
    setCheckMsg(null);
    try {
      const r = await dailyCheckin();
      if (!r.already) {
        setDisplayTaskPoints(Number(r.taskPointTotal ?? displayTaskPoints + Number(r.taskPoints ?? 0)));
      }
      setCheckMsg(
        r.already
          ? `Already checked in · streak ${r.streak}`
          : `Day ${r.streak} · +${r.taskPoints ?? 0} Task Points`,
      );
    } catch (e) {
      setCheckMsg(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setCheckBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-[#030814] px-3.5 pb-28 pt-3 text-white">
      <header className="mb-4 flex items-center gap-2.5">
        <img
          src={TASKORA_LOGO}
          alt="TASKORA"
          className="size-11 rounded-full object-cover ring-2 ring-cyan-400/50 shadow-[0_0_20px_rgba(34,211,238,0.35)]"
        />
        <div className="min-w-0 flex-1">
          <p
            className="text-[22px] font-black leading-none tracking-[0.06em]"
            style={{
              background: "linear-gradient(90deg,#e0f2fe,#38bdf8,#2563eb)",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            TASKORA
          </p>
          <p className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.22em] text-cyan-300/70">
            Earn · Play · Grow
          </p>
        </div>
        <Link
          to="/notifications"
          aria-label="Notifications"
          className="relative rounded-full border border-cyan-400/20 bg-[#0b1628] p-2.5 text-slate-300"
        >
          <Bell className="size-4" />
        </Link>
        <Link
          to="/profile"
          className="flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-[#0b1628] py-1 pl-1 pr-2.5"
        >
          {photo ? (
            <img src={photo} alt="" className="size-8 rounded-full object-cover" />
          ) : (
            <span className="flex size-8 items-center justify-center rounded-full bg-cyan-500/20 text-xs font-bold">
              {name.charAt(0)}
            </span>
          )}
          <div className="min-w-0 leading-tight">
            <p className="max-w-[72px] truncate text-[11px] font-bold">{name}</p>
            <p className="text-[9px] text-cyan-300/70">Level {levelNum}</p>
          </div>
          <ChevronRight className="size-3 text-slate-500" />
        </Link>
      </header>

      {isOwner ? (
        <Link
          to="/owner"
          className="mb-3 flex items-center justify-between rounded-2xl border border-cyan-400/25 bg-cyan-500/10 px-3.5 py-2.5 text-xs font-bold text-cyan-100"
        >
          <span className="inline-flex items-center gap-2">
            <Crown className="size-4 text-cyan-300" /> Owner Control Center
          </span>
          <ChevronRight className="size-4" />
        </Link>
      ) : null}

      <section
        className="relative mb-3.5 overflow-hidden rounded-[22px] border border-cyan-400/35 p-4 shadow-[0_0_40px_rgba(14,165,233,0.18)]"
        style={{
          background:
            "radial-gradient(circle at 92% 20%,rgba(56,189,248,0.28),transparent 36%), linear-gradient(145deg,#0a1a33 0%,#071221 55%,#050d1a 100%)",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
              Total Balance
            </span>
            <p className="mt-2 text-[42px] font-black leading-none tracking-tight text-white">
              {formatUsd(balance)}
            </p>
            <p className="mt-1.5 text-[11px] text-slate-400">
              Available: <span className="font-semibold text-cyan-200">{formatUsd(balance)}</span>
              {pending > 0 ? (
                <span className="text-slate-500"> · Pending {formatUsd(pending)}</span>
              ) : null}
            </p>
          </div>
          <div className="flex size-[72px] shrink-0 items-center justify-center rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-500/20 to-blue-600/10">
            <WalletCards className="size-8 text-cyan-200" />
          </div>
        </div>
        <Link
          to="/wallet"
          className="mt-3.5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-black text-white shadow-[0_8px_28px_rgba(37,99,235,0.35)]"
          style={{ background: BLUE_GRAD }}
        >
          <WalletCards className="size-3.5" />
          Withdraw
          <ChevronRight className="size-3.5" />
        </Link>
      </section>

      <section className="mb-3.5 space-y-2">
        <Quick to="/tasks" label="Tasks" sub="Complete & Earn" Icon={ClipboardCheck} />
        <Quick to="/watch-earn" label="Watch & Earn" sub="Watch Videos" Icon={PlayCircle} />
        <Quick to="/advertise" label="Advertise" sub="Campaigns" Icon={Megaphone} />
        <Quick to="/leaderboard" label="Rank" sub="Leaderboard" Icon={Trophy} />
        <Quick to="/ambassador" label="Invite & Earn" sub="Task Points" Icon={Users} />
      </section>

      <section className="mb-3.5 overflow-hidden rounded-[20px] border border-amber-400/35 bg-gradient-to-r from-[#1a1408] via-[#121a28] to-[#0c1524] p-3.5">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-amber-300/40 bg-amber-400/15 text-amber-200">
            <Star className="size-6 fill-amber-300 text-amber-300" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black">Task Points</p>
            <p className="text-2xl font-black text-amber-200">{displayTaskPoints.toLocaleString()}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-semibold text-slate-400">Next Level</p>
            <p className="text-[11px] font-bold text-slate-200">
              {displayTaskPoints.toLocaleString()} / {nextTarget.toLocaleString()}
            </p>
            <div className="mt-1 h-1.5 w-24 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
          <div className="text-center">
            <span className="inline-flex size-9 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 text-cyan-200">
              <Flame className="size-4" />
            </span>
            <p className="mt-1 text-[9px] font-bold text-cyan-200">Level {levelNum}</p>
            <p className="text-[8px] text-slate-500">{levelLabel}</p>
          </div>
        </div>
      </section>

      <button
        type="button"
        disabled={checkBusy}
        onClick={() => void onCheckin()}
        className="mb-3.5 flex w-full items-center gap-3 rounded-2xl border border-blue-400/20 bg-[#0b1628] px-3.5 py-3 text-left active:scale-[0.99]"
      >
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-cyan-300">
          <CalendarCheck className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Daily check-in</p>
          <p className="truncate text-[11px] text-slate-400">
            {checkMsg ?? `Streak ${streak}d · claim Task Points`}
          </p>
        </div>
        <span className="rounded-full bg-blue-500/15 px-2.5 py-1 text-[10px] font-black text-cyan-300">
          {checkBusy ? "…" : "Claim"}
        </span>
      </button>

      <section className="mb-3.5">
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-black">
              <ClipboardCheck className="size-4 text-cyan-300" /> Daily Tasks
            </h2>
            <p className="text-[10px] text-slate-500">Complete daily tasks and earn more Task Points!</p>
          </div>
          <Link to="/tasks" className="text-[11px] font-bold text-cyan-300">
            View All →
          </Link>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <DailyCard to="/tasks" title="Complete 3 Tasks" reward="+100 TP" progress={`${taskProgress}/3`} pct={(taskProgress / 3) * 100} Icon={ClipboardCheck} />
          <DailyCard to="/watch-earn" title="Watch 5 Videos" reward="+50 TP" progress="0/5" pct={0} Icon={PlayCircle} />
          <DailyCard to="/ambassador" title="Invite 1 Friend" reward="+200 TP" progress="0/1" pct={0} Icon={Users} />
        </div>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <div>
            <h2 className="flex items-center gap-1.5 text-sm font-black">
              <Flame className="size-4 text-orange-300" /> Top Tasks
            </h2>
            <p className="text-[10px] text-slate-500">High earning tasks, complete now!</p>
          </div>
          <Link to="/tasks" className="text-[11px] font-bold text-cyan-300">
            View All →
          </Link>
        </div>
        <div className="space-y-2">
          {tasks.length === 0 ? (
            <p className="rounded-2xl border border-white/8 bg-[#0b1628] p-4 text-sm text-slate-400">
              No live tasks yet. Publish from Advertise or Owner Center.
            </p>
          ) : (
            tasks.map((t: { id: string; title: string; reward: number; platform: string }) => (
              <Link
                key={t.id}
                to="/tasks/$taskId"
                params={{ taskId: t.id }}
                className="flex items-center gap-3 rounded-2xl border border-blue-400/15 bg-[#0b1628] p-3 active:scale-[0.995]"
              >
                <PlatformLogo platform={t.platform as Platform} size={42} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{t.title}</p>
                  <p className="text-[10px] text-slate-500">
                    {platformLabel(t.platform as Platform)} · +{formatUsd(t.reward)}
                  </p>
                </div>
                <span
                  className="inline-flex shrink-0 items-center rounded-full px-3 py-1.5 text-[11px] font-black text-white"
                  style={{ background: BLUE_GRAD }}
                >
                  Start →
                </span>
              </Link>
            ))
          )}
        </div>
      </section>
    </main>
  );
}

function Quick({
  to,
  label,
  sub,
  Icon,
  badge,
  muted,
}: {
  to: string;
  label: string;
  sub: string;
  Icon: ComponentType<{ className?: string }>;
  badge?: string;
  muted?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`relative flex w-full items-center gap-3 rounded-2xl border border-blue-400/15 bg-[#0b1628] px-3.5 py-3 text-left active:scale-[0.99] ${
        muted ? "opacity-90" : ""
      }`}
    >
      {badge ? (
        <span className="absolute -right-0.5 -top-1 rounded bg-cyan-400 px-1 py-0.5 text-[7px] font-black text-[#04101c]">
          {badge}
        </span>
      ) : null}
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-cyan-300">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold leading-tight">{label}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-slate-500" />
    </Link>
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
    <Link to={to} className="rounded-2xl border border-blue-400/15 bg-[#0b1628] p-2.5 active:scale-[0.98]">
      <span className="inline-flex size-8 items-center justify-center rounded-full bg-blue-500/15 text-cyan-300">
        <Icon className="size-4" />
      </span>
      <p className="mt-2 text-[11px] font-bold leading-tight">{title}</p>
      <p className="mt-0.5 text-[10px] font-black text-cyan-300">{reward}</p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
        <div className="h-full rounded-full bg-cyan-400" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <p className="mt-1 text-[9px] text-slate-500">{progress}</p>
    </Link>
  );
}
