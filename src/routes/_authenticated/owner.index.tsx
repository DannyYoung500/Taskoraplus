import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users,
  ClipboardCheck,
  Wallet,
  ShieldAlert,
  Settings,
  Crown,
  ChevronRight,
  Activity,
  LifeBuoy,
  Bell,
  AlertTriangle,
  Megaphone,
  BarChart3,
  CreditCard,
  PlayCircle,
  ScrollText,
} from "lucide-react";
import { ownerOverview } from "@/lib/owner.functions";
import { TaskoraLogo } from "@/components/TaskoraLogo";
import { OwnerShell } from "@/components/OwnerShell";

export const Route = createFileRoute("/_authenticated/owner/")({
  loader: async () => {
    try {
      const overview = await ownerOverview();
      return { overview, error: null as string | null };
    } catch (e) {
      return {
        overview: null,
        error: e instanceof Error ? e.message : "Owner access required",
      };
    }
  },
  component: OwnerHub,
});

/** Live modules only — each route exists and is wired. */
const MODULES = [
  { to: "/owner/reviews", title: "Task review", desc: "Approve or reject proofs", Icon: ClipboardCheck, badgeKey: "pendingReviews" as const },
  { to: "/owner/withdrawals", title: "Withdrawals", desc: "Mark paid or reject", Icon: Wallet, badgeKey: "pendingWithdrawals" as const },
  { to: "/owner/users", title: "Users & wallets", desc: "Search · adjust · ban", Icon: Users, badgeKey: null },
  { to: "/owner/tasks", title: "Tasks", desc: "Pause / activate", Icon: Activity, badgeKey: null },
  { to: "/owner/campaigns", title: "Campaigns", desc: "Budget · status", Icon: Activity, badgeKey: null },
  { to: "/advertise", title: "Publish task", desc: "Create marketplace tasks", Icon: Megaphone, badgeKey: null },
  { to: "/owner/deposits", title: "Deposits", desc: "Confirm / reject", Icon: Wallet, badgeKey: null },
  { to: "/owner/ledger", title: "Ledger", desc: "All movements", Icon: Wallet, badgeKey: null },
  { to: "/owner/fraud", title: "Fraud & risk", desc: "Open flags", Icon: ShieldAlert, badgeKey: "openFraud" as const },
  { to: "/owner/tickets", title: "Support", desc: "User tickets", Icon: LifeBuoy, badgeKey: "openTickets" as const },
  { to: "/owner/settings", title: "Economy · Webhook · Gate", desc: "Rates · fees · communities", Icon: Settings, badgeKey: null },
  { to: "/owner/payment-settings", title: "Payment settings", desc: "Networks · addresses", Icon: CreditCard, badgeKey: null },
  { to: "/owner/videos", title: "Watch & Earn", desc: "Video inventory", Icon: PlayCircle, badgeKey: null },
  { to: "/owner/welcome", title: "Bot /start welcome", desc: "Message · buttons · publish", Icon: Bell, badgeKey: null },
  { to: "/owner/announce", title: "Broadcast", desc: "In-app announcements", Icon: Bell, badgeKey: null },
  { to: "/owner/analytics", title: "Analytics", desc: "Growth & payouts", Icon: BarChart3, badgeKey: null },
  { to: "/owner/audit", title: "Audit log", desc: "Every owner action", Icon: ScrollText, badgeKey: null },
  { to: "/owner/health", title: "System health", desc: "Integrations", Icon: Activity, badgeKey: null },
] as const;

function OwnerHub() {
  const { overview, error } = Route.useLoaderData();
  const o = overview as Record<string, number> | null;

  const stats = o
    ? [
        { label: "Users", value: String(o.totalUsers ?? 0), sub: `${o.activeUsers ?? 0} active 7d`, accent: "text-sky-300" },
        { label: "Tasks live", value: String(o.activeTasks ?? 0), sub: `${o.activeCampaigns ?? 0} campaigns`, accent: "text-amber-300" },
        { label: "Reviews", value: String(o.pendingReviews ?? 0), sub: "pending proofs", accent: "text-sky-300" },
        { label: "Withdrawals", value: String(o.pendingWithdrawals ?? 0), sub: "awaiting payout", accent: "text-emerald-300" },
        { label: "Rewards paid", value: `$${Number(o.rewardsPaid ?? 0).toFixed(0)}`, sub: "ledger total", accent: "text-amber-300" },
        { label: "Deposits", value: `$${Number(o.depositsTotal ?? 0).toFixed(0)}`, sub: "completed", accent: "text-emerald-300" },
        { label: "Platform edge", value: `$${Number(o.platformRevenue ?? 0).toFixed(0)}`, sub: "dep − rewards", accent: "text-lime-300" },
        { label: "Risk open", value: String(o.openFraud ?? 0), sub: `${o.openTickets ?? 0} tickets`, accent: "text-red-300" },
      ]
    : [];

  return (
    <OwnerShell>
      <main className="px-4 pb-8 pt-4 text-white">
        <header className="mb-5 flex items-center gap-3">
          <TaskoraLogo size={44} />
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
              <Crown className="size-3.5" /> Owner Command
            </p>
            <h1 className="text-xl font-bold tracking-tight">Control Center</h1>
          </div>
        </header>

        {error ? (
          <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
            {error}
            <p className="mt-2 text-[11px] text-white/50">
              Set TASKORA_OWNER_TELEGRAM_IDS to your numeric Telegram ID on Vercel, then redeploy.
            </p>
          </div>
        ) : null}

        {stats.length ? (
          <div className="mb-5 grid grid-cols-2 gap-2">
            {stats.map((s) => (
              <div
                key={s.label}
                className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-[#161a24] to-[#0f1218] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
              >
                <p className="text-[11px] text-white/45">{s.label}</p>
                <p className={`mt-1 text-xl font-bold tabular-nums ${s.accent}`}>{s.value}</p>
                <p className="mt-0.5 text-[10px] text-white/30">{s.sub}</p>
              </div>
            ))}
          </div>
        ) : null}

        <div className="mb-6 grid grid-cols-2 gap-2">
          <Link
            to="/owner/reviews"
            className="flex items-center gap-2.5 rounded-2xl border border-sky-400/25 bg-sky-500/10 px-3 py-3.5 active:scale-[0.98]"
          >
            <ClipboardCheck className="size-5 text-sky-300" />
            <div>
              <p className="text-xs font-bold text-sky-100">Review now</p>
              <p className="text-[10px] text-white/40">{o?.pendingReviews ?? 0} waiting</p>
            </div>
          </Link>
          <Link
            to="/owner/withdrawals"
            className="flex items-center gap-2.5 rounded-2xl border border-emerald-400/25 bg-emerald-500/10 px-3 py-3.5 active:scale-[0.98]"
          >
            <Wallet className="size-5 text-emerald-300" />
            <div>
              <p className="text-xs font-bold text-emerald-100">Pay outs</p>
              <p className="text-[10px] text-white/40">{o?.pendingWithdrawals ?? 0} queue</p>
            </div>
          </Link>
          <Link
            to="/owner/settings"
            className="flex items-center gap-2.5 rounded-2xl border border-amber-400/25 bg-amber-500/10 px-3 py-3.5 active:scale-[0.98]"
          >
            <Settings className="size-5 text-amber-300" />
            <div>
              <p className="text-xs font-bold text-amber-100">Economy · Gate</p>
              <p className="text-[10px] text-white/40">Rates · webhook</p>
            </div>
          </Link>
          <Link
            to="/owner/fraud"
            className="flex items-center gap-2.5 rounded-2xl border border-red-400/25 bg-red-500/10 px-3 py-3.5 active:scale-[0.98]"
          >
            <AlertTriangle className="size-5 text-red-300" />
            <div>
              <p className="text-xs font-bold text-red-100">Fraud desk</p>
              <p className="text-[10px] text-white/40">{o?.openFraud ?? 0} open</p>
            </div>
          </Link>
        </div>

        <h2 className="mb-2.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/35">
          All modules
        </h2>
        <div className="space-y-1.5">
          {MODULES.map(({ to, title, desc, Icon, badgeKey }) => {
            const badge = badgeKey && o ? Number(o[badgeKey] ?? 0) : 0;
            return (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-[#12141c] p-3.5 transition active:scale-[0.99]"
              >
                <span className="inline-flex size-10 items-center justify-center rounded-xl bg-lime-400/10 text-lime-300">
                  <Icon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-[11px] text-white/40">{desc}</p>
                </div>
                {badge > 0 ? (
                  <span className="rounded-full bg-sky-400 px-2 py-0.5 text-[10px] font-bold text-[#0a0c12]">
                    {badge}
                  </span>
                ) : (
                  <ChevronRight className="size-4 text-white/25" />
                )}
              </Link>
            );
          })}
        </div>

        <p className="mt-8 text-center text-[10px] text-white/25">
          TASKORA Owner · live ledger · fail-closed gate
        </p>
      </main>
    </OwnerShell>
  );
}
