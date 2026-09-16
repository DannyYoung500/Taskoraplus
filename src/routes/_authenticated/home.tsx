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
    return { tasks: tasks.filter((task) => !isDemoTaskTitle(task.title)).slice(0, 8), dash };
  },
  component: HomePage,
});

function HomePage() {
  const { tasks, dash } = Route.useLoaderData();
  const transactions = (dash?.transactions ?? []).filter((tx) => !isDemoTransactionLabel(tx.label));
  const balance = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const pending = (dash?.submissions ?? [])
    .filter((submission) => submission.status === "pending" && !isDemoTaskTitle(submission.tasks?.title))
    .reduce((sum, submission) => sum + Number(submission.tasks?.reward ?? 0), 0);
  const name = dash?.profile?.display_name ?? "Tasker";
  const isOwner = Boolean(dash?.isOwner);
  const photo = (dash?.profile as { photo_url?: string | null } | null)?.photo_url ?? null;
  const streak = (dash?.profile as { streak?: number } | null)?.streak ?? 0;
  const [checkMsg, setCheckMsg] = useState<string | null>(null);
  const [checkBusy, setCheckBusy] = useState(false);

  async function onCheckin() {
    setCheckBusy(true);
    setCheckMsg(null);
    try {
      const r = await dailyCheckin();
      setCheckMsg(r.already ? `Already checked in · streak ${r.streak}` : `Day ${r.streak} · bonus applied`);
    } catch (e) {
      setCheckMsg(e instanceof Error ? e.message : "Check-in failed");
    } finally {
      setCheckBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#0b1424] px-4 pb-28 pt-4 text-white">
      <header className="mb-4 flex items-center gap-2.5">
        <img src={TASKORA_LOGO} alt="" className="size-10 rounded-full object-cover ring-2 ring-blue-400/40" />
        <div className="min-w-0 flex-1">
          <p
            className="text-lg font-extrabold tracking-wide"
            style={{
              background: "linear-gradient(90deg,#93c5fd,#3b82f6)",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            TASKORA
          </p>
          <p className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
            Complete tasks · Earn rewards
          </p>
        </div>
        <Link to="/notifications" className="relative rounded-full border border-slate-500/20 p-2 text-slate-300">
          <Bell className="size-4" />
        </Link>
        <Link to="/profile" className="overflow-hidden rounded-full border border-blue-400/40">
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
          className="mb-3 flex items-center justify-between rounded-2xl border border-blue-400/40 bg-blue-500/10 px-4 py-3 text-sm font-bold text-blue-300"
        >
          <span className="inline-flex items-center gap-2">
            <Crown className="size-4" /> Owner Control Center
          </span>
          <ChevronRight className="size-4" />
        </Link>
      ) : null}

      <section
        className="relative mb-4 overflow-hidden rounded-3xl border border-blue-500/25 p-5"
        style={{
          background:
            "radial-gradient(ellipse at 85% 40%, rgba(59,130,246,0.22), transparent 50%), linear-gradient(145deg,#121f33 0%,#0b1424 100%)",
        }}
      >
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-blue-400/30 bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-blue-300">
          <Crown className="size-3" /> Premium
        </div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-slate-400">Total Balance</p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight text-blue-300">
              {formatUsd(balance)}
            </p>
            <p className="mt-2 text-xs text-slate-400">
              Available <span className="text-slate-200">{formatUsd(balance)}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Pending</p>
            <Link to="/wallet" className="mt-1 block text-lg font-bold text-white">
              {formatUsd(pending)} ›
            </Link>
          </div>
        </div>
        <Link
          to="/tasks"
          className="mt-4 flex items-center gap-2 rounded-2xl border border-blue-400/20 bg-black/30 px-3 py-2.5 text-xs text-slate-300"
        >
          <Gift className="size-3.5 text-blue-300" />
          <span className="flex-1">Complete tasks, earn rewards, and level up!</span>
          <ChevronRight className="size-3.5" />
        </Link>
      </section>

      <button
        type="button"
        disabled={checkBusy}
        onClick={() => void onCheckin()}
        className="mb-4 flex w-full items-center gap-3 rounded-2xl border border-slate-500/15 bg-[#121f33] px-4 py-3 text-left active:scale-[0.99]"
      >
        <span className="inline-flex size-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
          <CalendarCheck className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Daily check-in</p>
          <p className="text-[11px] text-slate-400">
            {checkMsg ?? `Streak ${streak}d · tap to claim`}
          </p>
        </div>
        <span className="text-[11px] font-bold text-blue-300">{checkBusy ? "…" : "Claim"}</span>
      </button>

      <div className="mb-5 grid grid-cols-4 gap-2">
        <Quick to="/tasks" label="Browse Tasks" sub="Complete & Earn" Icon={ClipboardCheck} />
        <Quick to="/watch-earn" label="Watch & Earn" sub="View Videos" Icon={PlayCircle} />
        <Quick to="/ambassador" label="Invite & Earn" sub="Get Rewards" Icon={Users} />
        <Quick to="/leaderboard" label="Leaderboard" sub="Top Earners" Icon={Trophy} />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <Link
          to="/advertise"
          className="flex items-center gap-2 rounded-2xl border border-slate-500/15 bg-[#121f33] px-3 py-3"
        >
          <Megaphone className="size-4 text-blue-300" />
          <div>
            <p className="text-xs font-semibold">Advertise</p>
            <p className="text-[10px] text-slate-500">Publish tasks</p>
          </div>
        </Link>
        <Link
          to="/wallet"
          className="flex items-center gap-2 rounded-2xl border border-slate-500/15 bg-[#121f33] px-3 py-3"
        >
          <span className="text-sm font-bold text-blue-300">$</span>
          <div>
            <p className="text-xs font-semibold">Wallet</p>
            <p className="text-[10px] text-slate-500">Withdraw</p>
          </div>
        </Link>
      </div>

      <section className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold">Earn Today</h2>
        <Link to="/tasks" className="text-xs font-semibold text-blue-300">
          View All ›
        </Link>
      </section>

      <div className="space-y-2">
        {tasks.length === 0 ? (
          <p className="rounded-2xl border border-slate-500/15 bg-[#121f33] p-4 text-sm text-slate-400">
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
                className="flex items-center gap-3 rounded-2xl border border-slate-500/15 bg-[#121f33] p-3.5"
              >
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/5">
                  <PlatformIcon platform={t.platform as Platform} size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{t.title}</p>
                  <p className="text-[11px] text-slate-400">{t.platform}</p>
                </div>
                <span className="rounded-full bg-blue-500/15 px-2.5 py-1 text-xs font-bold text-blue-300">
                  +{formatUsd(t.reward)}
                </span>
              </Link>
            ),
          )
        )}
      </div>

      <Link
        to="/tasks"
        className="mt-4 flex items-center gap-3 rounded-2xl border border-blue-400/30 px-4 py-3.5"
        style={{ background: "linear-gradient(90deg, rgba(59,130,246,0.18), transparent)" }}
      >
        <Crown className="size-5 text-blue-300" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Level Up & Unlock More Rewards</p>
          <p className="text-[11px] text-slate-400">Complete tasks and climb the leaderboard.</p>
        </div>
        <span
          className="rounded-full px-3 py-1.5 text-[11px] font-bold text-white"
          style={{ background: BLUE_GRAD }}
        >
          Start ›
        </span>
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
      className="flex flex-col items-start gap-2 rounded-2xl border border-slate-500/15 bg-[#121f33] p-3"
    >
      <Icon className="size-5 text-blue-300" />
      <div>
        <p className="text-[11px] font-semibold leading-tight">{label}</p>
        <p className="text-[9px] text-slate-500">{sub}</p>
      </div>
    </Link>
  );
}
