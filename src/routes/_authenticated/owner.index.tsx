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
} from "lucide-react";
import { ownerOverview } from "@/lib/owner.functions";
import { getOwnerOverview } from "@/lib/taskora.functions";

const LOGO = "/file_00000000f8ec8246a98cce68ff972640.png";

export const Route = createFileRoute("/_authenticated/owner/")({
  loader: async () => {
    try {
      const rich = await ownerOverview();
      return { rich, basic: null as null, error: null as string | null };
    } catch {
      try {
        const basic = await getOwnerOverview();
        return { rich: null, basic, error: null as string | null };
      } catch (e) {
        return {
          rich: null,
          basic: null,
          error: e instanceof Error ? e.message : "Owner access required",
        };
      }
    }
  },
  component: OwnerHub,
});

const MODULES = [
  {
    to: "/owner/reviews",
    title: "Task review queue",
    desc: "Approve or reject pending proofs",
    Icon: ClipboardCheck,
  },
  {
    to: "/owner/withdrawals",
    title: "Withdrawal queue",
    desc: "Mark paid or reject payouts",
    Icon: Wallet,
  },
  {
    to: "/owner/users",
    title: "Users & wallets",
    desc: "Search, suspend, adjust balances",
    Icon: Users,
  },
  {
    to: "/owner/tasks",
    title: "Task management",
    desc: "Pause, activate, inspect campaigns",
    Icon: Activity,
  },
  {
    to: "/advertise",
    title: "Publish task",
    desc: "Create marketplace campaigns",
    Icon: Megaphone,
  },
  {
    to: "/owner/fraud",
    title: "Fraud & risk",
    desc: "Flags, multi-account signals",
    Icon: ShieldAlert,
  },
  {
    to: "/owner/analytics",
    title: "Analytics",
    desc: "Growth, payouts, completions",
    Icon: BarChart3,
  },
  {
    to: "/owner/settings",
    title: "Platform settings",
    desc: "Min withdrawal, rates, limits",
    Icon: Settings,
  },
] as const;

function OwnerHub() {
  const { rich, basic, error } = Route.useLoaderData();

  const stats = rich
    ? [
        { label: "Users", value: String(rich.totalUsers) },
        { label: "Active 7d", value: String(rich.activeUsers) },
        { label: "Pending reviews", value: String(rich.pendingReviews) },
        { label: "Pending payouts", value: String(rich.pendingWithdrawals) },
        { label: "Active tasks", value: String(rich.activeTasks) },
        { label: "Rewards paid", value: `$${Number(rich.rewardsPaid).toFixed(0)}` },
        { label: "Open fraud", value: String(rich.openFraud) },
        { label: "New 30d", value: String(rich.newUsers30d) },
      ]
    : basic
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
            Vercel must include TASKORA_OWNER_TELEGRAM_IDS=your_numeric_telegram_id then redeploy.
          </p>
        </div>
      ) : null}

      {stats.length ? (
        <div className="mb-5 grid grid-cols-2 gap-2">
          {stats.map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-white/8 bg-[#12141c] p-3"
            >
              <p className="text-[11px] text-white/45">{s.label}</p>
              <p className="mt-1 text-lg font-bold text-amber-300">{s.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
        Modules
      </h2>
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

      {rich?.recentActivity?.length ? (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-white/40">
            Recent admin activity
          </h2>
          <div className="space-y-1.5">
            {rich.recentActivity.slice(0, 8).map(
              (a: { id: string; action: string; admin_label?: string; created_at: string }) => (
                <div
                  key={a.id}
                  className="rounded-xl border border-white/5 bg-[#12141c] px-3 py-2 text-[11px] text-white/55"
                >
                  <span className="font-semibold text-white/80">{a.action}</span>
                  {a.admin_label ? ` · ${a.admin_label}` : ""}
                  <span className="block text-white/35">
                    {new Date(a.created_at).toLocaleString()}
                  </span>
                </div>
              ),
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}
