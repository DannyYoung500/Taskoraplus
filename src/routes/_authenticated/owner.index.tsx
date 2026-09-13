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
} from "lucide-react";
import { getOwnerOverview } from "@/lib/taskora.functions";

const LOGO = "/file_00000000f8ec8246a98cce68ff972640.png";

export const Route = createFileRoute("/_authenticated/owner/")({
  loader: async () => {
    try {
      const basic = await getOwnerOverview();
      return { basic, error: null as string | null };
    } catch (e) {
      return {
        basic: null,
        error: e instanceof Error ? e.message : "Owner access required",
      };
    }
  },
  component: OwnerHub,
});

const MODULES = [
  { to: "/owner/reviews", title: "Task review queue", desc: "Approve or reject proofs", Icon: ClipboardCheck },
  { to: "/owner/withdrawals", title: "Withdrawal queue", desc: "Mark paid or reject", Icon: Wallet },
  { to: "/owner/users", title: "Users & wallets", desc: "Search, suspend, adjust", Icon: Users },
  { to: "/owner/tasks", title: "Task management", desc: "Pause / activate campaigns", Icon: Activity },
  { to: "/advertise", title: "Publish task", desc: "Create marketplace tasks", Icon: Megaphone },
  { to: "/owner/fraud", title: "Fraud & risk", desc: "Anti-abuse playbook", Icon: ShieldAlert },
  { to: "/owner/analytics", title: "Analytics", desc: "Growth & payouts", Icon: BarChart3 },
  { to: "/owner/tickets", title: "Support tickets", desc: "User help queue", Icon: LifeBuoy },
  { to: "/owner/announce", title: "Broadcast", desc: "In-app announcements", Icon: Bell },
  { to: "/owner/settings", title: "Platform settings", desc: "Limits & rates", Icon: Settings },
] as const;

function OwnerHub() {
  const { basic, error } = Route.useLoaderData();

  const stats = basic
    ? [
        { label: "Users", value: String(basic.totalUsers) },
        { label: "Active tasks", value: String(basic.activeTasks) },
        { label: "Pending reviews", value: String(basic.pendingReviews) },
        { label: "Pending withdrawals", value: String(basic.pendingWithdrawals) },
        { label: "Rewards paid", value: `$${Number(basic.rewardsPaid).toFixed(2)}` },
      ]
    : [];

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <header className="mb-5 flex items-center gap-3">
        <img src={LOGO} alt="" className="size-11 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-300">
            <Crown className="size-3.5" /> Owner
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
            <div key={s.label} className="rounded-2xl border border-white/8 bg-[#12141c] p-3">
              <p className="text-[11px] text-white/45">{s.label}</p>
              <p className="mt-1 text-lg font-bold text-amber-300">{s.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/40">Modules</h2>
      <div className="space-y-2">
        {MODULES.map(({ to, title, desc, Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex items-center gap-3 rounded-2xl border border-white/8 bg-[#12141c] p-3.5"
          >
            <span className="inline-flex size-10 items-center justify-center rounded-xl bg-amber-400/10 text-amber-300">
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-[11px] text-white/40">{desc}</p>
            </div>
            <ChevronRight className="size-4 text-white/30" />
          </Link>
        ))}
      </div>
    </main>
  );
}
