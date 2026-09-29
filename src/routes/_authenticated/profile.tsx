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
import { TASKORA_LOGO, BLUE_GRAD } from "@/lib/brand";
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
  const band = 10;
  const intoBand = verified % band;
  const progressPct = Math.min(100, Math.round((intoBand / band) * 100));
  const nextLevelAt = band - intoBand;

  return (
    <main className="mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-[#05080f] pb-28 text-white">
      <header className="sticky top-0 z-20 border-b border-white/[0.07] bg-[#05080f]/95 px-3.5 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <img src={TASKORA_LOGO} alt="" className="size-9 rounded-full object-cover ring-1 ring-cyan-400/40" draggable={false} />
          <div className="min-w-0 flex-1">
            <p className="text-base font-black tracking-wide" style={{ background: "linear-gradient(90deg,#e0f2fe,#38bdf8,#2563eb)", WebkitBackgroundClip: "text", color: "transparent" }}>Profile</p>
            <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-cyan-300/70">Account · security · links</p>
          </div>
          <AppLink to="/notifications" aria-label="Notifications" className="rounded-full p-2 text-slate-300 hover:bg-white/5"><Bell className="size-5" /></AppLink>
          {isOwner ? (<AppLink to="/owner" aria-label="Owner" className="rounded-full border border-cyan-400/30 bg-cyan-500/10 p-2 text-cyan-200"><Crown className="size-4" /></AppLink>) : null}
        </div>
      </header>

      <div className="px-3.5 pt-4">
        <section className="overflow-hidden rounded-[22px] border border-cyan-400/25 p-4" style={{ background: "radial-gradient(circle at 90% 0%,rgba(56,189,248,0.2),transparent 45%), linear-gradient(160deg,#0a1a33 0%,#060f1c 60%,#05080f 100%)" }}>
          <div className="flex items-center gap-3.5">
            <div className="relative shrink-0">
              {photo ? (<img src={photo} alt="" className="size-[72px] rounded-full object-cover ring-2 ring-cyan-400/50" draggable={false} />) : (<span className="flex size-[72px] items-center justify-center rounded-full bg-cyan-500/20 text-2xl font-black ring-2 ring-cyan-400/40">{name.charAt(0).toUpperCase()}</span>)}
              <span className="absolute -bottom-0.5 -right-0.5 flex size-6 items-center justify-center rounded-full bg-emerald-400 text-[9px] font-black text-slate-950 ring-2 ring-[#0a1a33]">{levelNum}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-lg font-black leading-tight">{name}</p>
              <p className="mt-0.5 text-[12px] text-slate-400">{handle}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-bold text-cyan-200"><Star className="size-3" />{level}</span>
                {streak > 0 ? (<span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-200"><Zap className="size-3" />{streak}d streak</span>) : null}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-[10px]">
              <span className="font-semibold text-slate-400">Level progress</span>
              <span className="font-bold tabular-nums text-cyan-300/90">{intoBand}/{band} verified</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full transition-[width]" style={{ width: `${progressPct}%`, background: BLUE_GRAD }} />
            </div>
            <p className="mt-1 text-[9px] text-slate-500">{nextLevelAt} more verified task{nextLevelAt === 1 ? "" : "s"} to next band</p>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat label="Balance" value={formatUsd(balance)} accent />
            <Stat label="Verified" value={String(verified)} />
            <Stat label="Linked" value={String(connectedCount)} />
          </div>
        </section>

        <section className="mt-3.5 grid grid-cols-2 gap-2.5">
          <AppLink to="/wallet" className="flex items-center gap-2.5 rounded-2xl border border-cyan-400/15 bg-[#0b1628] p-3.5 active:scale-[0.98]">
            <span className="flex size-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300"><WalletCards className="size-5" /></span>
            <div className="min-w-0"><p className="text-xs font-black">Wallet</p><p className="text-[10px] text-slate-500">Deposit · withdraw</p></div>
          </AppLink>
          <AppLink to="/leaderboard" className="flex items-center gap-2.5 rounded-2xl border border-cyan-400/15 bg-[#0b1628] p-3.5 active:scale-[0.98]">
            <span className="flex size-10 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-300"><Trophy className="size-5" /></span>
            <div className="min-w-0"><p className="text-xs font-black">Rank</p><p className="text-[10px] text-slate-500">Leaderboard</p></div>
          </AppLink>
        </section>

        <section className="mt-3.5 overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0b1628]">
          <Row to="/ambassador" icon={Users} label="Invite & Earn" sub="USDT milestones + commission" />
          <Row to="/connected" icon={Link2} label="Connected accounts" sub={connectedCount > 0 ? `${connectedCount} linked · required for some platforms` : "Link TikTok, Instagram, YouTube…"} badge={connectedCount > 0 ? String(connectedCount) : undefined} />
          <Row to="/proof-rules" icon={Shield} label="Proof standards" sub="How verification works" />
          <Row to="/support" icon={LifeBuoy} label="Support" sub="Tickets & help" />
          <Row to="/notifications" icon={Bell} label="Notifications" sub="Alerts & updates" />
        </section>

        <section className="mt-3.5 rounded-2xl border border-white/[0.07] bg-[#0b1628] p-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Lifetime</p>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-emerald-400/15 bg-emerald-500/5 px-3 py-2.5">
              <p className="text-[10px] text-slate-500">Total earned</p>
              <p className="mt-0.5 text-base font-black tabular-nums text-emerald-300">{formatUsd(lifetime)}</p>
            </div>
            <div className="rounded-xl border border-cyan-400/15 bg-cyan-500/5 px-3 py-2.5">
              <p className="text-[10px] text-slate-500">Tasks verified</p>
              <p className="mt-0.5 text-base font-black tabular-nums text-cyan-200">{verified}</p>
            </div>
          </div>
        </section>

        <div className="mt-3.5 flex items-start gap-2.5 rounded-2xl border border-emerald-400/20 bg-emerald-500/5 px-3.5 py-3 text-[11px] leading-relaxed text-emerald-200/90">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
          <span>Telegram-native session · real ledger balances · no demo money. Proofs are one-per-user and device-locked.</span>
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/30 px-2 py-2.5 text-center">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-0.5 truncate text-sm font-black tabular-nums ${accent ? "text-cyan-200" : "text-white"}`}>{value}</p>
    </div>
  );
}

function Row({ to, icon: Icon, label, sub, badge }: { to: string; icon: typeof Trophy; label: string; sub: string; badge?: string }) {
  return (
    <AppLink to={to} className="flex items-center gap-3 border-b border-white/[0.05] px-3.5 py-3.5 last:border-0 active:bg-white/[0.04]">
      <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-300"><Icon className="size-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-100">{label}</p>
        <p className="text-[10px] text-slate-500">{sub}</p>
      </div>
      {badge ? <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] font-black text-cyan-200">{badge}</span> : null}
      <ChevronRight className="size-4 shrink-0 text-slate-600" />
    </AppLink>
  );
}
