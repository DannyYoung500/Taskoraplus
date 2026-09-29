import { createFileRoute } from "@tanstack/react-router";
import {
  Bell,
  ChevronRight,
  Crown,
  LifeBuoy,
  Link2,
  Shield,
  Trophy,
  WalletCards,
  Users,
} from "lucide-react";
import { getDashboard } from "@/lib/taskora.functions";
import { getGrowthSummary } from "@/lib/growth.functions";
import { listConnectedAccounts } from "@/lib/connected-accounts.functions";
import { TASKORA_LOGO } from "@/lib/brand";
import { formatUsd, isDemoTransactionLabel } from "@/lib/taskora-display";
import { AppLink } from "@/components/AppLink";

export const Route = createFileRoute("/_authenticated/profile")({
  loader: async () => {
    const [dash, accounts, growth] = await Promise.all([
      getDashboard().catch(() => null),
      listConnectedAccounts().catch(() => []),
      getGrowthSummary().catch(() => null),
    ]);
    return { dash, accounts, growth };
  },
  head: () => ({ meta: [{ title: "Profile — TASKORA" }] }),
  component: ProfileScreen,
});

function ProfileScreen() {
  const { dash, accounts, growth } = Route.useLoaderData();
  const profile = dash?.profile as
    | {
        display_name?: string | null;
        username?: string | null;
        level?: string | null;
        level_num?: number | null;
        streak?: number | null;
        photo_url?: string | null;
      }
    | null
    | undefined;

  const name = profile?.display_name ?? "Tasker";
  const handle = profile?.username ? `@${profile.username}` : "Telegram user";
  const levelNum = profile?.level_num ?? 1;
  const level = profile?.level ?? `Level ${levelNum}`;
  const photo = profile?.photo_url ?? null;
  const streak = Number(profile?.streak ?? 0);
  const isOwner = Boolean(dash?.isOwner);

  const txs = (dash?.transactions ?? []).filter((tx) => !isDemoTransactionLabel(tx.label));
  const balance = Math.max(0, txs.reduce((s, t) => s + Number(t.amount), 0));
  const lifetime = txs
    .filter((t) => Number(t.amount) > 0)
    .reduce((s, t) => s + Number(t.amount), 0);
  const verified = Number(dash?.verifiedCount ?? 0);

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl overflow-x-hidden bg-[#030814] px-4 pb-28 pt-4 text-white sm:px-6">
      <header className="mb-5 flex items-center gap-3">
        <img src={TASKORA_LOGO} alt="" className="size-11 rounded-full ring-2 ring-cyan-400/40" />
        <div className="min-w-0 flex-1">
          <p
            className="text-xl font-black tracking-[0.04em]"
            style={{
              background: "linear-gradient(90deg,#e0f2fe,#38bdf8,#2563eb)",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}
          >
            Profile
          </p>
          <p className="text-xs text-slate-500">Account, activity, connections and support</p>
        </div>
        <AppLink
          to="/notifications"
          aria-label="Notifications"
          className="rounded-xl border border-white/10 bg-[#0b1628] p-2.5"
        >
          <Bell className="size-4 text-slate-300" />
        </AppLink>
      </header>

      <section
        className="mb-4 overflow-hidden rounded-3xl border border-cyan-400/25 p-5"
        style={{
          background:
            "radial-gradient(circle at 92% 8%,rgba(56,189,248,0.20),transparent 34%), linear-gradient(145deg,#0a1a33,#060f1c)",
        }}
      >
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3.5">
            {photo ? (
              <img src={photo} alt="" className="size-[72px] shrink-0 rounded-full object-cover ring-2 ring-cyan-400/50" />
            ) : (
              <span className="flex size-[72px] shrink-0 items-center justify-center rounded-full bg-cyan-500/20 text-2xl font-black ring-2 ring-cyan-400/40">
                {name.charAt(0)}
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-xl font-black">{name}</p>
              <p className="mt-0.5 truncate text-sm text-slate-400">{handle}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] font-bold text-cyan-200">
                  {level}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-slate-400">
                  {streak} day streak
                </span>
              </div>
            </div>
          </div>

          {isOwner ? (
            <AppLink
              to="/owner"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2.5 text-sm font-bold text-cyan-200"
            >
              <Crown className="size-4" />
              Owner Console
            </AppLink>
          ) : null}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Stat label="Available balance" value={formatUsd(balance)} />
          <Stat label="Lifetime earned" value={formatUsd(lifetime)} />
          <Stat label="Verified tasks" value={String(verified)} />
        </div>
      </section>

      <section className="mb-4">
        <SectionHeading title="Level & badges" sub="Calculated from verified activity and real earnings" />
        <div className="rounded-2xl border border-white/8 bg-[#0b1628] p-4">
          <div className="flex items-center justify-between"><div><p className="text-sm font-black">{growth?.level.name ?? level}</p><p className="text-[10px] text-slate-500">Level {growth?.level.number ?? levelNum} · {growth?.level.progress ?? 0}% to next</p></div><p className="text-xs font-bold text-cyan-300">{growth?.activity.tasks ?? verified} verified tasks</p></div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-cyan-400" style={{width:`${growth?.level.progress ?? 0}%`}} /></div>
          <div className="mt-3 flex flex-wrap gap-2">{(growth?.badges ?? []).map((b)=><span key={b.id} title={b.detail} className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${b.unlocked ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-300" : "border-white/8 bg-white/5 text-slate-500"}`}>{b.name}</span>)}</div>
        </div>
      </section>

      <section className="mb-4">
        <SectionHeading title="Money & activity" sub="Manage your earnings and account activity" />
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <ActionCard to="/wallet" icon={WalletCards} label="Wallet" sub="Balance, deposits and withdrawals" />
          <ActionCard to="/leaderboard" icon={Trophy} label="Leaderboard" sub="See your position and community rankings" />
          <ActionCard to="/ambassador" icon={Users} label="Invite & Earn" sub="Referrals and commission activity" />
          <ActionCard to="/notifications" icon={Bell} label="Notifications" sub="Account and earning alerts" />
        </div>
      </section>

      <section className="mb-4">
        <SectionHeading title="Account & verification" sub="Keep your account connected and understand verification" />
        <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#0b1628]">
          <Row to="/connected" icon={Link2} label="Connected accounts" sub={accounts.length ? `${accounts.length} linked account${accounts.length === 1 ? "" : "s"}` : "No accounts linked"} />
          <Row to="/proof-rules" icon={Shield} label="Proof standards" sub="How task verification and evidence work" />
        </div>
      </section>

      <section className="mb-4">
        <SectionHeading title="Help & policies" sub="Get support or review the rules" />
        <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#0b1628]">
          <Row to="/support" icon={LifeBuoy} label="Support" sub="Get help and manage support tickets" />
          <Row to="/terms" icon={Shield} label="Terms & Conditions" sub="TaskoraPlus rules and policies" />
        </div>
      </section>

      <div className="flex items-start gap-2.5 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 px-4 py-3 text-xs leading-5 text-emerald-200/90">
        <Shield className="mt-0.5 size-4 shrink-0" />
        <span>Telegram-native account · real wallet ledger · no demo balances</span>
      </div>
    </main>
  );
}

function SectionHeading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-2.5 px-1">
      <p className="text-sm font-black text-white">{title}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>
    </div>
  );
}

function ActionCard({
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
    <AppLink
      to={to}
      className="group flex min-h-[78px] items-center gap-3 rounded-2xl border border-white/8 bg-[#0b1628] px-4 py-3.5 transition-colors hover:border-cyan-400/20 hover:bg-[#0d1b31] active:bg-white/5"
    >
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-cyan-300">
        <Icon className="size-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{label}</p>
        <p className="mt-0.5 text-[11px] leading-4 text-slate-500">{sub}</p>
      </div>
      <ChevronRight className="size-4 shrink-0 text-slate-600 transition-transform group-hover:translate-x-0.5" />
    </AppLink>
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
    <AppLink
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
    </AppLink>
  );
}
