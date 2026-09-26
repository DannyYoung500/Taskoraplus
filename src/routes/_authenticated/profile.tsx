import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Bell,
  ChevronRight,
  Crown,
  LifeBuoy,
  Link2,
  Shield,
  Trophy,
  WalletCards,
  Star,
  Users,
} from "lucide-react";
import { getDashboard } from "@/lib/taskora.functions";
import { listConnectedAccounts } from "@/lib/connected-accounts.functions";
import { TASKORA_LOGO, BLUE_GRAD } from "@/lib/brand";
import { formatUsd, isDemoTransactionLabel } from "@/lib/taskora-display";

export const Route = createFileRoute("/_authenticated/profile")({
  loader: async () => {
    const [dash, accounts] = await Promise.all([
      getDashboard().catch(() => null),
      listConnectedAccounts().catch(() => []),
    ]);
    return { dash, accounts };
  },
  head: () => ({ meta: [{ title: "Profile — TASKORA" }] }),
  component: ProfileScreen,
});

function ProfileScreen() {
  const { dash, accounts } = Route.useLoaderData();
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
  const level = profile?.level ?? `Level ${levelNum}`;
  const photo = profile?.photo_url ?? null;
  const streak = Number(profile?.streak ?? 0);
  const taskPoints = Number(profile?.task_points ?? 0);
  const isOwner = Boolean(dash?.isOwner);

  const txs = (dash?.transactions ?? []).filter((tx) => !isDemoTransactionLabel(tx.label));
  const balance = Math.max(
    0,
    txs.reduce((s, t) => s + Number(t.amount), 0),
  );
  const lifetime = txs.filter((t) => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);
  const verified = Number(dash?.verifiedCount ?? 0);

  return (
    <main className="mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-[#030814] px-3.5 pb-28 pt-3 text-white">
      <header className="mb-4 flex items-center gap-2.5">
        <img src={TASKORA_LOGO} alt="" className="size-10 rounded-full ring-2 ring-cyan-400/40" />
        <div className="min-w-0 flex-1">
          <p
            className="text-lg font-black tracking-[0.06em]"
            style={{
              background: "linear-gradient(90deg,#e0f2fe,#38bdf8,#2563eb)",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            Profile
          </p>
          <p className="text-[10px] text-slate-500">Account · security · links</p>
        </div>
        <Link to="/notifications" className="rounded-full border border-white/10 bg-[#0b1628] p-2.5">
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
            <img src={photo} alt="" className="size-16 rounded-full object-cover ring-2 ring-cyan-400/50" />
          ) : (
            <span className="flex size-16 items-center justify-center rounded-full bg-cyan-500/20 text-xl font-black ring-2 ring-cyan-400/40">
              {name.charAt(0)}
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-black">{name}</p>
            <p className="text-[12px] text-slate-400">{handle}</p>
            <span className="mt-1 inline-flex rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-200">
              {level}
            </span>
          </div>
          {isOwner ? (
            <Link
              to="/owner"
              className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-2 text-cyan-200"
            >
              <Crown className="size-5" />
            </Link>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Balance" value={formatUsd(balance)} />
          <Stat label="Task Points" value={taskPoints.toLocaleString()} />
          <Stat label="Streak" value={`${streak}d`} />
        </div>
      </section>

      <section className="mb-3 grid grid-cols-2 gap-2">
        <Link
          to="/wallet"
          className="flex items-center gap-2.5 rounded-2xl border border-blue-400/15 bg-[#0b1628] p-3.5"
        >
          <WalletCards className="size-5 text-cyan-300" />
          <div>
            <p className="text-xs font-black">Wallet</p>
            <p className="text-[10px] text-slate-500">Deposit · withdraw</p>
          </div>
        </Link>
        <Link
          to="/leaderboard"
          className="flex items-center gap-2.5 rounded-2xl border border-blue-400/15 bg-[#0b1628] p-3.5"
        >
          <Trophy className="size-5 text-cyan-300" />
          <div>
            <p className="text-xs font-black">Rank</p>
            <p className="text-[10px] text-slate-500">Leaderboard</p>
          </div>
        </Link>
      </section>

      <section className="mb-3 overflow-hidden rounded-2xl border border-white/8 bg-[#0b1628]">
        <Row to="/ambassador" icon={Users} label="Invite & Earn" sub="Task Points + commission" />
        <Row to="/connected" icon={Link2} label="Connected accounts" sub={`${accounts.length} linked`} />
        <Row to="/proof-rules" icon={Shield} label="Proof standards" sub="How verification works" />
        <Row to="/payout-proofs" icon={Shield} label="Payout proofs" sub="Public paid withdrawal log" />
        <Row to="/support" icon={LifeBuoy} label="Support" sub="Tickets & help" />
        <Row to="/notifications" icon={Bell} label="Notifications" sub="Alerts" />
      </section>

      <section className="mb-3 rounded-2xl border border-white/8 bg-[#0b1628] p-3.5">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Stats</p>
        <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
          <div className="rounded-xl bg-black/25 px-3 py-2">
            <p className="text-[10px] text-slate-500">Lifetime earned</p>
            <p className="font-black text-emerald-300">{formatUsd(lifetime)}</p>
          </div>
          <div className="rounded-xl bg-black/25 px-3 py-2">
            <p className="text-[10px] text-slate-500">Tasks verified</p>
            <p className="font-black">{verified}</p>
          </div>
        </div>
      </section>

      <div className="flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 px-3 py-2.5 text-[11px] text-emerald-200/90">
        <Shield className="size-4 shrink-0" />
        Telegram-native session · ledger balances · no demo balances
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/25 px-2 py-2 text-center">
      <p className="text-[9px] font-semibold text-slate-500">{label}</p>
      <p className="mt-0.5 truncate text-sm font-black">{value}</p>
    </div>
  );
}

function Row({
  to,
  icon: Icon,
  label,
  sub,
}: {
  to: string;
  icon: typeof Trophy;
  label: string;
  sub: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 border-b border-white/5 px-3.5 py-3.5 last:border-0 active:bg-white/5"
    >
      <span className="inline-flex size-9 items-center justify-center rounded-xl bg-blue-500/10 text-cyan-300">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{label}</p>
        <p className="text-[10px] text-slate-500">{sub}</p>
      </div>
      <ChevronRight className="size-4 text-slate-600" />
    </Link>
  );
}
