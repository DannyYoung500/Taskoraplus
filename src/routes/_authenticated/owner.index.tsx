import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Users,
  ClipboardCheck,
  Wallet,
  ShieldAlert,
  Megaphone,
  BarChart3,
  Settings,
  Crown,
  ChevronRight,
  Activity,
  LifeBuoy,
  Bell,
  AlertTriangle,
} from "lucide-react";
import { ownerOverview } from "@/lib/owner.functions";

import { TaskoraLogo } from "@/components/TaskoraLogo";

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

const MODULES = [
  { to: "/owner/reviews", title: "Task review queue", desc: "Approve or reject proofs", Icon: ClipboardCheck, badgeKey: "pendingReviews" as const },
  { to: "/owner/withdrawals", title: "Withdrawal queue", desc: "Mark paid or reject", Icon: Wallet, badgeKey: "pendingWithdrawals" as const },
  { to: "/owner/users", title: "Users & wallets", desc: "Profiles · search · adjust · ban", Icon: Users, badgeKey: null },
  { to: "/owner/tasks", title: "Task management", desc: "Pause / activate campaigns", Icon: Activity, badgeKey: null },
  { to: "/owner/campaigns", title: "Campaigns", desc: "Budget · spend · status", Icon: Activity, badgeKey: null },
  { to: "/advertise", title: "Publish task", desc: "Create marketplace tasks", Icon: Megaphone, badgeKey: null },
  { to: "/owner/fraud", title: "Fraud & risk", desc: "Anti-abuse playbook", Icon: ShieldAlert, badgeKey: "openFraud" as const },
  { to: "/owner/flags", title: "Risk flags", desc: "Open cases · resolve", Icon: AlertTriangle, badgeKey: null },
  { to: "/owner/analytics", title: "Analytics", desc: "Growth & payouts", Icon: BarChart3, badgeKey: null },
  { to: "/owner/ledger", title: "Ledger", desc: "All ledger movements", Icon: Wallet, badgeKey: null },
  { to: "/owner/deposits", title: "Deposits", desc: "Confirm / reject deposits", Icon: Wallet, badgeKey: null },
  { to: "/owner/tickets", title: "Support tickets", desc: "User help queue", Icon: LifeBuoy, badgeKey: "openTickets" as const },
  { to: "/owner/announce", title: "Broadcast", desc: "In-app announcements", Icon: Bell, badgeKey: null },
  { to: "/owner/welcome", title: "Bot /start welcome", desc: "Photo · message · buttons · publish", Icon: Megaphone, badgeKey: null },
  { to: "/owner/settings", title: "Economy · Webhook · Gate", desc: "Rates · fees · pauses · register bot webhook", Icon: Settings, badgeKey: null },
  { to: "/owner/economy", title: "Economy (advanced)", desc: "Deep rate controls", Icon: Settings, badgeKey: null },
  { to: "/owner/monetization", title: "Providers", desc: "Ad / offerwall keys", Icon: Megaphone, badgeKey: null },
  { to: "/owner/payment-settings", title: "Payment settings", desc: "Networks · addresses · rules", Icon: Wallet, badgeKey: null },
  { to: "/owner/videos", title: "Watch videos", desc: "Upload / manage inventory", Icon: Activity, badgeKey: null },
  { to: "/owner/documents", title: "Documents", desc: "Task briefs · PDFs", Icon: ClipboardCheck, badgeKey: null },
  { to: "/owner/roles", title: "Roles", desc: "Admin / staff roles", Icon: Users, badgeKey: null },
  { to: "/owner/connected", title: "Connected accounts", desc: "Platform links audit", Icon: Users, badgeKey: null },
  { to: "/owner/audit", title: "Audit log", desc: "Every owner action", Icon: ShieldAlert, badgeKey: null },
  { to: "/owner/health", title: "System health", desc: "Integrations · uptime", Icon: Activity, badgeKey: null },
] as const;

function OwnerHub() {
  const { overview, error } = Route.useLoaderData();
  const o = overview as Record<string, number> | null;

  const stats = o
    ? [
        { label: "Users", value: String(o.totalUsers ?? 0), sub: `${o.activeUsers ?? 0} active 7d` },
        { label: "Tasks live", value: String(o.activeTasks ?? 0), sub: `${o.activeCampaigns ?? 0} campaigns` },
        { label: "Reviews", value: String(o.pendingReviews ?? 0), sub: "pending proofs" },
        { label: "Withdrawals", value: String(o.pendingWithdrawals ?? 0), sub: "awaiting payout" },
        { label: "Rewards paid", value: `$${Number(o.rewardsPaid ?? 0).toFixed(0)}`, sub: "ledger total" },
        { label: "Deposits", value: `$${Number(o.depositsTotal ?? 0).toFixed(0)}`, sub: "completed" },
        { label: "Platform edge", value: `$${Number(o.platformRevenue ?? 0).toFixed(0)}`, sub: "dep − rewards" },
        { label: "Risk open", value: String(o.openFraud ?? 0), sub: `${o.openTickets ?? 0} tickets` },
      ]
    : [];

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <header className="mb-5 flex items-center gap-3">
        <TaskoraLogo size={44} />
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
            <Crown className="size-3.5" /> Owner Command
          </p>
          <h1 className="text-xl font-bold">Control Center</h1>
        </div>
        <Link to="/home" className="text-xs text-white/45">
          App ›
        </Link>
      </header>

      {error ? (
        <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
          {error}
          <p className="mt-2 text-[11px] text-white/50">
            Set TASKORA_OWNER_TELEGRAM_IDS to your numeric Telegram ID on Vercel, then redeploy and reopen the Mini App.
          </p>
        </div>
      ) : null}

      {stats.length ? (
        <div className="mb-5 grid grid-cols-2 gap-2">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-white/8 bg-gradient-to-b from-[#161a24] to-[#12141c] p-3"
            >
              <p className="text-[11px] text-white/45">{s.label}</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-amber-300">{s.value}</p>
              <p className="mt-0.5 text-[10px] text-white/30">{s.sub}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mb-5 grid grid-cols-2 gap-2">
        <Link
          to="/owner/reviews"
          className="flex items-center gap-2 rounded-2xl border border-sky-400/20 bg-sky-400/10 px-3 py-3"
        >
          <ClipboardCheck className="size-5 text-sky-300" />
          <div>
            <p className="text-xs font-bold text-sky-100">Review now</p>
            <p className="text-[10px] text-white/40">{o?.pendingReviews ?? 0} waiting</p>
          </div>
        </Link>
        <Link
          to="/owner/withdrawals"
          className="flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-3 py-3"
        >
          <Wallet className="size-5 text-emerald-300" />
          <div>
            <p className="text-xs font-bold text-emerald-100">Pay outs</p>
            <p className="text-[10px] text-white/40">{o?.pendingWithdrawals ?? 0} queue</p>
          </div>
        </Link>
        <Link
          to="/owner/settings"
          className="flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-400/10 px-3 py-3"
        >
          <Settings className="size-5 text-amber-300" />
          <div>
            <p className="text-xs font-bold text-amber-100">Economy · Gate</p>
            <p className="text-[10px] text-white/40">Rates · webhook · communities</p>
          </div>
        </Link>
        <Link
          to="/owner/fraud"
          className="flex items-center gap-2 rounded-2xl border border-red-400/20 bg-red-400/10 px-3 py-3"
        >
          <AlertTriangle className="size-5 text-red-300" />
          <div>
            <p className="text-xs font-bold text-red-100">Fraud desk</p>
            <p className="text-[10px] text-white/40">{o?.openFraud ?? 0} open flags</p>
          </div>
        </Link>
      </div>

      <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/40">All modules</h2>
      <div className="space-y-2">
        {MODULES.map(({ to, title, desc, Icon, badgeKey }) => {
          const badge = badgeKey && o ? Number(o[badgeKey] ?? 0) : 0;
          return (
            <Link
              key={to}
              to={to}
              className="flex items-center gap-3 rounded-2xl border border-white/8 bg-[#12141c] p-3.5 transition active:scale-[0.99]"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300">
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
                <ChevronRight className="size-4 text-white/30" />
              )}
            </Link>
          );
        })}
      </div>

      <p className="mt-6 text-center text-[10px] text-white/25">
        TASKORA Owner · live ledger · fail-closed gate
      </p>
    </main>
  );
}
