import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ClipboardCheck,
  Wallet,
  Users,
  Activity,
  BarChart3,
  ShieldAlert,
  ChevronRight,
} from "lucide-react";
import { getOwnerOverview } from "@/lib/taskora.functions";
import { OwnerShell } from "@/components/OwnerShell";

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

const QUICK = [
  { to: "/owner/reviews", title: "Task Review", desc: "Approve proofs", Icon: ClipboardCheck },
  { to: "/owner/withdrawals", title: "Withdrawals", desc: "Pay · reject", Icon: Wallet },
  { to: "/owner/users", title: "Users", desc: "Search · suspend", Icon: Users },
  { to: "/owner/tasks", title: "Tasks", desc: "Lifecycle", Icon: Activity },
  { to: "/owner/analytics", title: "Analytics", desc: "KPIs", Icon: BarChart3 },
  { to: "/owner/fraud", title: "Fraud", desc: "Risk queue", Icon: ShieldAlert },
] as const;

function OwnerHub() {
  const { basic, error } = Route.useLoaderData();

  const stats = basic
    ? [
        { label: "Users", value: String(basic.totalUsers) },
        { label: "Tasks", value: String(basic.activeTasks) },
        { label: "Reviews", value: String(basic.pendingReviews) },
        { label: "Payouts", value: String(basic.pendingWithdrawals) },
        { label: "Paid", value: `$${Number(basic.rewardsPaid).toFixed(0)}` },
      ]
    : [];

  return (
    <OwnerShell>
      <div className="px-4 pt-4">
        <div
          className="mb-4 overflow-hidden rounded-3xl border border-blue-400/25 p-5"
          style={{
            background:
              "radial-gradient(ellipse at 20% 0%, rgba(59,130,246,0.25), transparent 55%), linear-gradient(160deg,#152033,#0b1424)",
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-blue-300">Overview</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight">Command Center</h1>
          <p className="mt-1 text-[11px] text-slate-400">
            Open the menu (☰) for the full owner navigation — Users, Tasks, Campaigns, Money, System…
          </p>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-blue-400/30 bg-blue-500/10 p-4 text-sm text-blue-100">
            {error}
            <p className="mt-2 text-[11px] text-slate-400">
              Set TASKORA_OWNER_TELEGRAM_IDS on Vercel → Redeploy → open as that Telegram user.
            </p>
          </div>
        ) : null}

        {stats.length ? (
          <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
            {stats.map((s) => (
              <div
                key={s.label}
                className="min-w-[88px] shrink-0 rounded-2xl border border-slate-500/15 bg-[#121f33] px-3 py-3"
              >
                <p className="text-[10px] uppercase tracking-wide text-slate-500">{s.label}</p>
                <p className="mt-1 text-lg font-bold text-blue-300">{s.value}</p>
              </div>
            ))}
          </div>
        ) : null}

        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Quick actions</p>
        <div className="grid grid-cols-2 gap-2.5">
          {QUICK.map(({ to, title, desc, Icon }) => (
            <Link
              key={to}
              to={to as "/owner"}
              className="rounded-2xl border border-slate-500/15 bg-[#121f33] p-3.5 active:scale-[0.98]"
            >
              <span className="mb-2 inline-flex size-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                <Icon className="size-4" />
              </span>
              <p className="text-sm font-semibold">{title}</p>
              <p className="mt-0.5 text-[10px] text-slate-500">{desc}</p>
              <span className="mt-2 inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-300">
                Open <ChevronRight className="size-3" />
              </span>
            </Link>
          ))}
        </div>

        <p className="mt-6 text-center text-[11px] text-slate-500">
          Full menu is in the sidebar — same structure as your TASKORA owner nav.
        </p>
      </div>
    </OwnerShell>
  );
}
