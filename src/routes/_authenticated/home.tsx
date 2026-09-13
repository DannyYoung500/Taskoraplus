import { createFileRoute, Link } from "@tanstack/react-router";
import type { ComponentType } from "react";
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
} from "lucide-react";
import { listTasks, getDashboard } from "@/lib/taskora.functions";
import { PlatformIcon, type Platform } from "@/components/PlatformIcon";

const LOGO = "/file_00000000f8ec8246a98cce68ff972640.png";

export const Route = createFileRoute("/_authenticated/home")({
  loader: async () => {
    const [tasks, dash] = await Promise.all([
      listTasks().catch(() => []),
      getDashboard().catch(() => null),
    ]);
    return { tasks: tasks.slice(0, 8), dash };
  },
  component: HomePage,
});

function HomePage() {
  const { tasks, dash } = Route.useLoaderData();
  const balance = Number(dash?.balance ?? 0);
  const pending = Number(dash?.pending ?? 0);
  const name = dash?.profile?.display_name ?? "Tasker";
  const isOwner = Boolean(dash?.isOwner);
  const photo = (dash?.profile as { photo_url?: string | null } | null)?.photo_url ?? null;

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-4 text-white">
      <header className="mb-4 flex items-center gap-2.5">
        <img src={LOGO} alt="" className="size-10 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <p
            className="text-lg font-extrabold tracking-wide"
            style={{
              background: "linear-gradient(90deg,#FFE08A,#F5C542)",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            TASKORA
          </p>
          <p className="text-[10px] uppercase tracking-[0.14em] text-white/45">
            Complete tasks · Earn rewards
          </p>
        </div>
        <Link to="/profile" className="relative rounded-full border border-white/10 p-2 text-white/70">
          <Bell className="size-4" />
        </Link>
        <Link to="/profile" className="overflow-hidden rounded-full border border-primary/40">
          {photo ? (
            <img src={photo} alt="" className="size-9 object-cover" />
          ) : (
            <span className="flex size-9 items-center justify-center bg-white/10 text-xs font-bold">
              {name.charAt(0)}
            </span>
          )}
        </Link>
      </header>

      {isOwner ? (
        <Link
          to="/owner"
          className="mb-3 flex items-center justify-between rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm font-bold text-amber-300"
        >
          <span className="inline-flex items-center gap-2">
            <Crown className="size-4" /> Owner Control Center
          </span>
          <ChevronRight className="size-4" />
        </Link>
      ) : null}

      <section
        className="relative mb-4 overflow-hidden rounded-3xl border border-amber-500/25 p-5"
        style={{
          background:
            "radial-gradient(ellipse at 85% 40%, rgba(245,197,66,0.18), transparent 50%), linear-gradient(145deg,#12141c 0%,#0a0c12 100%)",
        }}
      >
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-300">
          <Crown className="size-3" /> Premium
        </div>
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-white/50">Total Balance</p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight text-amber-300">
              ${balance.toFixed(2)}
            </p>
            <p className="mt-2 text-xs text-white/45">
              Available <span className="text-white/80">${balance.toFixed(2)}</span>
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-white/50">Pending</p>
            <Link to="/wallet" className="mt-1 block text-lg font-bold text-white">
              ${pending.toFixed(2)} ›
            </Link>
          </div>
        </div>
        <Link
          to="/tasks"
          className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-black/30 px-3 py-2.5 text-xs text-white/70"
        >
          <Gift className="size-3.5 text-amber-300" />
          <span className="flex-1">Complete tasks, earn rewards, and level up!</span>
          <ChevronRight className="size-3.5" />
        </Link>
      </section>

      <div className="mb-5 grid grid-cols-4 gap-2">
        <Quick to="/tasks" label="Browse Tasks" sub="Complete & Earn" Icon={ClipboardCheck} />
        <Quick to="/watch-earn" label="Watch & Earn" sub="View Videos" Icon={PlayCircle} />
        <Quick to="/ambassador" label="Invite & Earn" sub="Get Rewards" Icon={Users} />
        <Quick to="/leaderboard" label="Leaderboard" sub="Top Earners" Icon={Trophy} />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <Link
          to="/advertise"
          className="flex items-center gap-2 rounded-2xl border border-white/8 bg-[#12141c] px-3 py-3"
        >
          <Megaphone className="size-4 text-amber-300" />
          <div>
            <p className="text-xs font-semibold">Advertise</p>
            <p className="text-[10px] text-white/40">Publish tasks</p>
          </div>
        </Link>
        <Link
          to="/wallet"
          className="flex items-center gap-2 rounded-2xl border border-white/8 bg-[#12141c] px-3 py-3"
        >
          <span className="text-sm font-bold text-amber-300">$</span>
          <div>
            <p className="text-xs font-semibold">Wallet</p>
            <p className="text-[10px] text-white/40">Withdraw</p>
          </div>
        </Link>
      </div>

      <section className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-bold">Earn Today</h2>
        <Link to="/tasks" className="text-xs font-semibold text-amber-300">
          View All ›
        </Link>
      </section>

      <div className="space-y-2">
        {tasks.length === 0 ? (
          <p className="rounded-2xl border border-white/8 bg-[#12141c] p-4 text-sm text-white/50">
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
                className="flex items-center gap-3 rounded-2xl border border-white/8 bg-[#12141c] p-3.5"
              >
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/5">
                  <PlatformIcon platform={t.platform as Platform} size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{t.title}</p>
                  <p className="text-[11px] text-white/40">
                    {t.platform}
                    {t.seconds
                      ? ` · ${Math.max(1, Math.round(t.seconds / 60))}–${Math.max(2, Math.round(t.seconds / 30))} mins`
                      : ""}
                  </p>
                </div>
                <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-bold text-amber-300">
                  +${Number(t.reward).toFixed(2)}
                </span>
              </Link>
            ),
          )
        )}
      </div>

      <Link
        to="/tasks"
        className="mt-4 flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-500/15 to-transparent px-4 py-3.5"
      >
        <Crown className="size-5 text-amber-300" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Level Up & Unlock More Rewards</p>
          <p className="text-[11px] text-white/45">
            Complete tasks, earn higher rewards, climb the leaderboard.
          </p>
        </div>
        <span className="rounded-full bg-amber-400 px-3 py-1.5 text-[11px] font-bold text-[#0a0c12]">
          Start Now ›
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
      className="flex flex-col items-start gap-2 rounded-2xl border border-white/8 bg-[#12141c] p-3"
    >
      <Icon className="size-5 text-amber-300" />
      <div>
        <p className="text-[11px] font-semibold leading-tight">{label}</p>
        <p className="text-[9px] text-white/40">{sub}</p>
      </div>
    </Link>
  );
}
