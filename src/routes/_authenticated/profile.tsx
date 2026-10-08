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
  Star,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { getDashboard } from "@/lib/taskora.functions";
import { listConnectedAccounts } from "@/lib/connected-accounts.functions";
import { TASKORA_LOGO, ACCENT_GRAD } from "@/lib/brand";
import { formatUsd, isDemoTransactionLabel } from "@/lib/taskora-display";
import { AppLink } from "@/components/AppLink";

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
      }
    | null
    | undefined;

  const name = profile?.display_name ?? "Tasker";
  const handle = profile?.username ? `@${profile.username}` : "Telegram user";
  const levelNum = Math.max(1, Number(profile?.level_num ?? 1));
  const level = profile?.level ?? `Level ${levelNum}`;
  const photo = profile?.photo_url ?? null;
  const streak = Number(profile?.streak ?? 0);
  const isOwner = Boolean(dash?.isOwner);

  const txs = (dash?.transactions ?? []).filter((tx) => !isDemoTransactionLabel(tx.label));
  const balance = Math.max(0, txs.reduce((s, t) => s + Number(t.amount), 0));
  const lifetime = txs.filter((t) => Number(t.amount) > 0).reduce((s, t) => s + Number(t.amount), 0);
  const verified = Number(dash?.verifiedCount ?? 0);
  const connectedCount = Array.isArray(accounts) ? accounts.length : 0;
  const band = 20;
  const intoBand = verified % band;
  const progressPct = Math.min(100, Math.round((intoBand / band) * 100));
  const nextLevelAt = band - intoBand;

  return (
    <main className="mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-[#080808] pb-28 text-neutral-100">
      <header className="sticky top-0 z-20 bg-[#080808]/95 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <img src={TASKORA_LOGO} alt="" className="size-8 rounded-lg object-cover" draggable={false} />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-neutral-50">Profile</p>
            <p className="text-[10px] font-normal text-neutral-500">Account · security</p>
          </div>
          <AppLink to="/notifications" aria-label="Notifications" className="p-2 text-neutral-400">
            <Bell className="size-5" strokeWidth={1.75} />
          </AppLink>
          {isOwner ? (
            <AppLink to="/owner" aria-label="Owner" className="p-2 text-orange-400">
              <Crown className="size-4" strokeWidth={1.75} />
            </AppLink>
          ) : null}
        </div>
      </header>

      <div className="px-4 pt-3">
        <section className="overflow-hidden rounded-2xl bg-[#121212] p-4">
          <div className="flex items-center gap-3.5">
            <div className="relative shrink-0">
              {photo ? (
                <img src={photo} alt="" className="size-16 rounded-full object-cover" draggable={false} />
              ) : (
                <span className="flex size-16 items-center justify-center rounded-full bg-neutral-800 text-xl font-medium text-neutral-300">
                  {name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[16px] font-medium text-neutral-50">{name}</p>
              <p className="mt-0.5 text-[12px] font-normal text-neutral-500">{handle}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-orange-400">
                  <Star className="size-3" strokeWidth={1.75} /> {level}
                </span>
                {streak > 0 ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-normal text-amber-400/90">
                    <Zap className="size-3" strokeWidth={1.75} /> {streak}d streak
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <span className="font-normal text-neutral-500">Level progress</span>
              <span className="font-medium tabular-nums text-orange-400">
                {intoBand}/{band}
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full"
                style={{ width: `${progressPct}%`, background: ACCENT_GRAD }}
              />
            </div>
            <p className="mt-1 text-[10px] font-normal text-neutral-600">
              {nextLevelAt} more verified to next band
            </p>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat label="Balance" value={formatUsd(balance)} accent />
            <Stat label="Verified" value={String(verified)} />
            <Stat label="Linked" value={String(connectedCount)} />
          </div>
        </section>

        <section className="mt-3 grid grid-cols-2 gap-2">
          <AppLink
            to="/wallet"
            className="flex items-center gap-2.5 rounded-2xl bg-[#121212] p-3.5 active:opacity-90"
          >
            <WalletCards className="size-5 text-orange-400" strokeWidth={1.75} />
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-neutral-100">Wallet</p>
              <p className="text-[10px] font-normal text-neutral-500">Deposit · withdraw</p>
            </div>
          </AppLink>
          <AppLink
            to="/leaderboard"
            className="flex items-center gap-2.5 rounded-2xl bg-[#121212] p-3.5 active:opacity-90"
          >
            <Trophy className="size-5 text-orange-400" strokeWidth={1.75} />
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-neutral-100">Rank</p>
              <p className="text-[10px] font-normal text-neutral-500">Leaderboard</p>
            </div>
          </AppLink>
        </section>

        <section className="mt-3 overflow-hidden rounded-2xl bg-[#121212]">
          <Row to="/ambassador" icon={Users} label="Invite & Earn" sub="USDT milestones + commission" />
          <Row
            to="/connected"
            icon={Link2}
            label="Connected accounts"
            sub={connectedCount > 0 ? `${connectedCount} linked` : "Link social accounts"}
            badge={connectedCount > 0 ? String(connectedCount) : undefined}
          />
          <Row to="/proof-rules" icon={Shield} label="Proof standards" sub="How verification works" />
          <Row to="/support" icon={LifeBuoy} label="Support" sub="Tickets & help" />
          <Row to="/notifications" icon={Bell} label="Notifications" sub="Alerts & updates" />
        </section>

        <section className="mt-3 rounded-2xl bg-[#121212] p-3.5">
          <p className="text-[10px] font-normal text-neutral-500">Lifetime</p>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-[#0a0a0a] px-3 py-2.5">
              <p className="text-[10px] font-normal text-neutral-500">Total earned</p>
              <p className="mt-0.5 text-[15px] font-medium tabular-nums text-emerald-400">
                {formatUsd(lifetime)}
              </p>
            </div>
            <div className="rounded-xl bg-[#0a0a0a] px-3 py-2.5">
              <p className="text-[10px] font-normal text-neutral-500">Tasks verified</p>
              <p className="mt-0.5 text-[15px] font-medium tabular-nums text-orange-400">{verified}</p>
            </div>
          </div>
        </section>

        <div className="mt-3 flex items-start gap-2.5 rounded-2xl bg-emerald-500/5 px-3.5 py-3 text-[11px] font-normal leading-relaxed text-emerald-200/80">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" strokeWidth={1.75} />
          <span>Telegram-native · real ledger · no demo money.</span>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-[#0a0a0a] px-2 py-2.5 text-center">
      <p className="text-[9px] font-normal text-neutral-500">{label}</p>
      <p
        className={`mt-0.5 truncate text-[13px] font-medium tabular-nums ${
          accent ? "text-orange-400" : "text-neutral-100"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function Row({
  to,
  icon: Icon,
  label,
  sub,
  badge,
}: {
  to: string;
  icon: typeof Trophy;
  label: string;
  sub: string;
  badge?: string;
}) {
  return (
    <AppLink
      to={to}
      className="flex items-center gap-3 border-b border-white/[0.04] px-3.5 py-3.5 last:border-0 active:bg-white/[0.03]"
    >
      <Icon className="size-4 shrink-0 text-orange-400" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-neutral-100">{label}</p>
        <p className="text-[10px] font-normal text-neutral-500">{sub}</p>
      </div>
      {badge ? (
        <span className="text-[11px] font-medium text-orange-400">{badge}</span>
      ) : null}
      <ChevronRight className="size-4 shrink-0 text-neutral-600" strokeWidth={1.75} />
    </AppLink>
  );
}
