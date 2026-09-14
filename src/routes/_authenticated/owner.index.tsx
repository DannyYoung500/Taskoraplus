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
  FileText,
} from "lucide-react";
import { getOwnerOverview } from "@/lib/taskora.functions";
import { TASKORA_LOGO } from "@/lib/brand";

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
  { to: "/owner/reviews" as const, title: "Task reviews", desc: "Approve or reject proofs", Icon: ClipboardCheck },
  { to: "/owner/withdrawals" as const, title: "Withdrawals", desc: "Mark paid or reject", Icon: Wallet },
  { to: "/owner/users" as const, title: "Users", desc: "Search · suspend · adjust", Icon: Users },
  { to: "/owner/tasks" as const, title: "Tasks", desc: "Activate · pause · complete", Icon: Activity },
  { to: "/advertise" as const, title: "Publish", desc: "Create marketplace tasks", Icon: Megaphone },
  { to: "/owner/documents" as const, title: "Documents", desc: "Upload long PDFs / briefs", Icon: FileText },
  { to: "/owner/fraud" as const, title: "Fraud", desc: "Risk playbook", Icon: ShieldAlert },
  { to: "/owner/analytics" as const, title: "Analytics", desc: "Growth & payouts", Icon: BarChart3 },
  { to: "/owner/tickets" as const, title: "Support", desc: "Ticket queue", Icon: LifeBuoy },
  { to: "/owner/announce" as const, title: "Broadcast", desc: "Announcements", Icon: Bell },
  { to: "/owner/settings" as const, title: "Settings", desc: "Gate · channel or group", Icon: Settings },
];

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
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <div
        className="mb-5 overflow-hidden rounded-3xl border border-amber-400/25 p-5"
        style={{
          background:
            "radial-gradient(ellipse at 20% 0%, rgba(245,197,66,0.22), transparent 55%), linear-gradient(160deg,#161820,#0a0c12)",
        }}
      >
        <div className="flex items-center gap-3">
          <img src={TASKORA_LOGO} alt="" className="size-12 rounded-full object-cover ring-2 ring-amber-400/40" />
          <div className="min-w-0 flex-1">
            <p className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-300">
              <Crown className="size-3" /> Owner control
            </p>
            <h1 className="text-2xl font-extrabold tracking-tight">Command Center</h1>
            <p className="text-[11px] text-white/45">TASKORA · live operations</p>
          </div>
          <Link to="/home" className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-white/60">
            App
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
          {error}
          <p className="mt-2 text-[11px] text-white/50">
            Vercel env: TASKORA_OWNER_TELEGRAM_IDS=your_numeric_id → Redeploy → open Mini App as that Telegram user.
          </p>
        </div>
      ) : null}

      {stats.length ? (
        <div className="mb-5 flex gap-2 overflow-x-auto pb-1">
          {stats.map((s) => (
            <div
              key={s.label}
              className="min-w-[88px] shrink-0 rounded-2xl border border-white/8 bg-[#12141c] px-3 py-3"
            >
              <p className="text-[10px] uppercase tracking-wide text-white/40">{s.label}</p>
              <p className="mt-1 text-lg font-bold text-amber-300">{s.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Modules</p>
      <div className="grid grid-cols-2 gap-2.5">
        {MODULES.map(({ to, title, desc, Icon }) => (
          <Link
            key={to}
            to={to}
            className="group rounded-2xl border border-white/8 bg-[#12141c] p-3.5 transition active:scale-[0.98]"
          >
            <span className="mb-2 inline-flex size-9 items-center justify-center rounded-xl bg-amber-400/12 text-amber-300">
              <Icon className="size-4" />
            </span>
            <p className="text-sm font-semibold leading-tight">{title}</p>
            <p className="mt-0.5 text-[10px] leading-snug text-white/40">{desc}</p>
            <span className="mt-2 inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-300/80">
              Open <ChevronRight className="size-3" />
            </span>
          </Link>
        ))}
      </div>
    </main>
  );
}
