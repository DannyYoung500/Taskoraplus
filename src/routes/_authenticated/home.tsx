import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ComponentType } from "react";
import {
  ClipboardCheck,
  PlayCircle,
  Users,
  Trophy,
  Bell,
  Megaphone,
  Crown,
  Gift,
  ChevronRight,
  CalendarCheck,
  WalletCards,
  CircleDollarSign,
  Sparkles,
  ArrowUpRight,
  Info,
} from "lucide-react";
import { listTasks, getDashboard, dailyCheckin } from "@/lib/taskora.functions";
import { PlatformIcon, type Platform } from "@/components/PlatformIcon";
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

function HomePage() {
  const { tasks, dash } = Route.useLoaderData();
  const transactions = (dash?.transactions ?? []).filter((tx) => !isDemoTransactionLabel(tx.label));
  const rawBalance = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const balance = rawBalance <= 0.00005 ? 0 : rawBalance;
  const pending = (dash?.submissions ?? [])
    .filter((submission) => submission.status === "pending" && !isDemoTaskTitle(submission.tasks?.title))
    .reduce((sum, submission) => sum + Number(submission.tasks?.reward ?? 0), 0);

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
  const level = profile?.level_num ? `Level ${profile.level_num}` : profile?.level ?? "Level 1";
  const isOwner = Boolean(dash?.isOwner);

  const [checkMsg, setCheckMsg] = useState<string | null>(null);
  const [displayTaskPoints, setDisplayTaskPoints] = useState(taskPoints);
  const [checkBusy, setCheckBusy] = useState(false);

  async function onCheckin() {
    setCheckBusy(true);
    setCheckMsg(null);
    try {
      const r = await dailyCheckin();
      if (!r.already) setDisplayTaskPoints(Number(r.taskPointTotal ?? displayTaskPoints + Number(r.taskPoints ?? 0)));
      setCheckMsg(r.already ? `Already checked in · streak ${r.streak}` : `Day ${r.streak} · +${r.taskPoints ?? 0} Task Points`);
    } catch (e) {
      setCheckMsg(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setCheckBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-[#06111f] px-4 pb-28 pt-4 text-white">
      <header className="mb-5 flex items-center gap-2.5">
        <img
          src={TASKORA_LOGO}
          alt="TASKORA"
          className="size-11 rounded-full object-cover ring-2 ring-blue-400/40"
        />
        <div className="min-w-0 flex-1">
          <p
            className="text-xl font-black tracking-[0.08em]"
            style={{
              background: "linear-gradient(90deg,#e0f2fe,#38bdf8,#2563eb)",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            TASKORA
          </p>
          <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Earn · Play · Grow
          </p>
        </div>

        <Link
          to="/notifications"
          aria-label="Notifications"
          className="relative rounded-full border border-blue-400/20 bg-[#0b1b2e] p-2.5 text-slate-300 shadow-[0_0_24px_rgba(37,99,235,0.08)]"
        >
          <Bell className="size-4" />
        </Link>

        <Link to="/profile" aria-label="Profile" className="overflow-hidden rounded-full border border-blue-400/50">
          {photo ? (
            <img src={photo} alt="" className="size-9 object-cover" />
          ) : (
            <span className="flex size-9 items-center justify-center bg-blue-500/20 text-xs font-bold">
              {name.charAt(0)}
            </span>
          )}
        </Link>
      </header>

      {isOwner ? (
        <Link
          to="/owner"
          className="mb-4 flex items-center justify-between rounded-2xl border border-blue-400/30 bg-blue-500/[0.08] px-4 py-3 text-sm font-bold text-blue-200 shadow-[0_0_28px_rgba(37,99,235,0.08)]"
        >
          <span className="inline-flex items-center gap-2">
            <Crown className="size-4 text-cyan-300" /> Owner Control Center
          </span>
          <ChevronRight className="size-4" />
        </Link>
      ) : null}

      <section
        className="relative mb-4 overflow-hidden rounded-[28px] border border-cyan-400/30 p-5 shadow-[0_0_42px_rgba(14,165,233,0.10)]"
        style={{
          background:
            "radial-gradient(circle at 88% 20%,rgba(14,165,233,0.22),transparent 34%), radial-gradient(circle at 15% 100%,rgba(37,99,235,0.15),transparent 42%), linear-gradient(145deg,#0d2238 0%,#071321 68%,#06101d 100%)",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/25 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-200">
            <Sparkles className="size-3" /> Total Balance
          </span>
          <span className="text-[10px] font-semibold text-slate-500">USDT value</span>
        </div>

        <div className="mt-4 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-400">Available balance</p>
            <p className="mt-1 truncate text-[40px] font-black leading-none tracking-tight text-white">
              {formatUsd(balance)}
            </p>
            <p className="mt-2 text-[11px] text-slate-400">
              Pending <span className="font-bold text-slate-200">{formatUsd(pending)}</span>
            </p>
          </div>

          <Link
            to="/wallet"
            className="inline-flex shrink-0 items-center gap-2 rounded-2xl px-4 py-3 text-xs font-black text-white shadow-[0_8px_30px_rgba(37,99,235,0.25)]"
            style={{ background: BLUE_GRAD }}
          >
            <WalletCards className="size-4" />
            Withdraw
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </section>

      <button
        type="button"
        disabled={checkBusy}
        onClick={() => void onCheckin()}
        className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-blue-400/15 bg-[#0b1b2e] px-4 py-3 text-left shadow-[0_0_25px_rgba(37,99,235,0.05)] active:scale-[0.99]"
      >
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-cyan-300">
          <CalendarCheck className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Daily check-in</p>
          <p className="truncate text-[11px] text-slate-400">
            {checkMsg ?? `Streak ${streak}d · keep your daily streak alive`}
          </p>
        </div>
        <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-[10px] font-black text-cyan-300">
          {checkBusy ? "…" : "Claim"}
        </span>
      </button>

      <section className="mb-4 grid grid-cols-4 gap-2">
        <Quick to="/tasks" label="Tasks" sub="Complete & earn" Icon={ClipboardCheck} />
        <Quick to="/watch-earn" label="Watch" sub="Watch & earn" Icon={PlayCircle} />
        <Quick to="/ambassador" label="Invite" sub="Task Points & commission" Icon={Users} />
        <Quick to="/leaderboard" label="Rank" sub="Leaderboard" Icon={Trophy} />
      </section>

      <Link to="/leaderboard" className="mb-4 block rounded-[24px] border border-yellow-400/35 bg-[radial-gradient(circle_at_10%_50%,rgba(250,204,21,0.13),transparent_35%),linear-gradient(110deg,#111c2b,#091626)] p-4 shadow-[0_0_35px_rgba(250,204,21,0.07)]">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-yellow-300/40 bg-yellow-400/10 text-yellow-200 shadow-[0_0_22px_rgba(250,204,21,0.18)]">
            <CircleDollarSign className="size-7" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-black">Task Points</p>
              <span title="Task Points are separate from withdrawable balance." className="text-slate-500">
                <Info className="size-3.5" />
              </span>
            </div>
            <p className="mt-0.5 text-[10px] text-slate-400">Non-withdrawable points from eligible activity</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-black text-yellow-200">{displayTaskPoints.toLocaleString()}</p>
            <p className="text-[10px] font-bold text-cyan-300">{level}</p>
          </div>
        </div>
      </Link>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <Link
          to="/advertise"
          className="group flex items-center gap-3 rounded-2xl border border-blue-400/15 bg-[#0b1b2e] px-3.5 py-3.5 transition active:scale-[0.99]"
        >
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-cyan-300">
            <Megaphone className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black">Advertise</p>
            <p className="text-[10px] text-slate-500">Publish campaigns</p>
          </div>
          <ChevronRight className="size-3.5 text-slate-600 transition group-hover:text-cyan-300" />
        </Link>

        <Link
          to="/wallet"
          className="group flex items-center gap-3 rounded-2xl border border-blue-400/15 bg-[#0b1b2e] px-3.5 py-3.5 transition active:scale-[0.99]"
        >
          <span className="inline-flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-cyan-300">
            <WalletCards className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black">Wallet</p>
            <p className="text-[10px] text-slate-500">Manage balance</p>
          </div>
          <ChevronRight className="size-3.5 text-slate-600 transition group-hover:text-cyan-300" />
        </Link>
      </div>

      <section className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-base font-black">Earn Today</h2>
          <p className="mt-0.5 text-[10px] text-slate-500">Live tasks from the TASKORA marketplace</p>
        </div>
        <Link to="/tasks" className="text-xs font-black text-cyan-300">
          View All <ChevronRight className="inline size-3.5" />
        </Link>
      </section>

      <div className="space-y-2.5">
        {tasks.length === 0 ? (
          <p className="rounded-2xl border border-slate-500/15 bg-[#0b1b2e] p-4 text-sm text-slate-400">
            No live tasks yet. Publish from Advertise / Owner Center.
          </p>
        ) : (
          tasks.map(
            (t: {
              id: string;
              title: string;
              reward: number;
              platform: string;
              seconds?: number;
            }) => (
              <Link
                key={t.id}
                to="/tasks/$taskId"
                params={{ taskId: t.id }}
                className="group flex items-center gap-3 rounded-2xl border border-blue-400/10 bg-[#0b1b2e] p-3.5 shadow-[0_0_24px_rgba(37,99,235,0.04)] active:scale-[0.995]"
              >
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-white/[0.04]">
                  <PlatformIcon platform={t.platform as Platform} size={21} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{t.title}</p>
                  <p className="mt-0.5 text-[10px] text-slate-500">{t.platform}</p>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-cyan-400/15 bg-cyan-400/10 px-2.5 py-1.5 text-[11px] font-black text-cyan-200">
                  +{formatUsd(t.reward)}
                  <ChevronRight className="size-3 text-cyan-400/60" />
                </span>
              </Link>
            ),
          )
        )}
      </div>

      <Link
        to="/tasks"
        className="mt-4 flex items-center gap-3 rounded-2xl border border-blue-400/20 px-4 py-3.5 shadow-[0_0_30px_rgba(37,99,235,0.07)]"
        style={{ background: "linear-gradient(90deg, rgba(37,99,235,0.18), rgba(14,165,233,0.04), transparent)" }}
      >
        <span className="inline-flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-cyan-300">
          <Gift className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black">Level Up & Unlock More Rewards</p>
          <p className="text-[10px] text-slate-500">Complete eligible activity and keep building your Task Points.</p>
        </div>
        <ChevronRight className="size-4 text-cyan-300" />
      </Link>
    </main>
  );
}

function Quick({
  to,
  label,
  sub,
  Icon,
}: {
  to: string;
  label: string;
  sub: string;
  Icon: ComponentType<{ className?: string }>;
}) {
  return (
    <Link
      to={to}
      className="flex min-w-0 flex-col gap-2 rounded-2xl border border-blue-400/10 bg-[#0b1b2e] p-3 shadow-[0_0_20px_rgba(37,99,235,0.04)] active:scale-[0.98]"
    >
      <span className="inline-flex size-9 items-center justify-center rounded-xl bg-blue-500/10 text-cyan-300">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-black">{label}</p>
        <p className="truncate text-[9px] text-slate-500">{sub}</p>
      </div>
    </Link>
  );
}
