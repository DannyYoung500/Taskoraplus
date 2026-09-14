import { createFileRoute, Link } from "@tanstack/react-router";
import type { ComponentType } from "react";
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
  Coins,
  Flag,
  ScrollText,
  HeartPulse,
  Link2,
  Trophy,
  Lock,
  Landmark,
  BookOpen,
  ArrowDownCircle,
  Shield,
  PlayCircle,
  CalendarCheck,
  Database,
  CreditCard,
  Home,
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

type Mod = {
  to: string;
  title: string;
  desc: string;
  Icon: ComponentType<{ className?: string }>;
};

/** Full Owner menu — everything accessible from Command Center */
const SECTIONS: { label: string; items: Mod[] }[] = [
  {
    label: "Core ops",
    items: [
      { to: "/owner/reviews", title: "Proof & Moderation", desc: "Approve · reject", Icon: ClipboardCheck },
      { to: "/owner/withdrawals", title: "Withdrawals", desc: "Pay · reject · hold", Icon: Wallet },
      { to: "/owner/deposits", title: "Deposits", desc: "Pending · confirmed", Icon: ArrowDownCircle },
      { to: "/owner/ledger", title: "Ledger", desc: "Reconciliation", Icon: BookOpen },
      { to: "/owner/users", title: "Users", desc: "Search · suspend", Icon: Users },
      { to: "/owner/connected", title: "Connected Accounts", desc: "Verify · revoke", Icon: Link2 },
    ],
  },
  {
    label: "Tasks & campaigns",
    items: [
      { to: "/owner/tasks", title: "Tasks", desc: "Lifecycle control", Icon: Activity },
      { to: "/owner/campaigns", title: "Campaigns", desc: "Budget · pause", Icon: Landmark },
      { to: "/advertise", title: "Publish", desc: "Create tasks", Icon: Megaphone },
      { to: "/owner/documents", title: "Documents", desc: "PDF briefs", Icon: FileText },
      { to: "/watch-earn", title: "Watch & Earn", desc: "Provider status", Icon: PlayCircle },
    ],
  },
  {
    label: "Economy & risk",
    items: [
      { to: "/owner/economy", title: "Economy", desc: "$10 min · prices", Icon: Coins },
      { to: "/owner/fraud", title: "Fraud & Risk", desc: "Queue · scores", Icon: ShieldAlert },
      { to: "/owner/analytics", title: "Analytics", desc: "Growth · finance", Icon: BarChart3 },
      { to: "/leaderboard", title: "XP & Leaderboards", desc: "Ranks", Icon: Trophy },
    ],
  },
  {
    label: "Comms & access",
    items: [
      { to: "/owner/tickets", title: "Support", desc: "Tickets", Icon: LifeBuoy },
      { to: "/owner/announce", title: "Notifications", desc: "Broadcast", Icon: Bell },
      { to: "/owner/settings", title: "Telegram Gate", desc: "Channel or group", Icon: Lock },
      { to: "/owner/flags", title: "Feature Flags", desc: "Kill switches", Icon: Flag },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/owner/roles", title: "Roles", desc: "Permissions", Icon: Shield },
      { to: "/owner/audit", title: "Audit Logs", desc: "All actions", Icon: ScrollText },
      { to: "/owner/health", title: "System Health", desc: "DB · Bot · Auth", Icon: HeartPulse },
      { to: "/owner/settings", title: "Payment Settings", desc: "Rails · fees", Icon: CreditCard },
      { to: "/owner/settings", title: "Platform Settings", desc: "Limits · defaults", Icon: Settings },
      { to: "/owner/economy", title: "Daily Check-in", desc: "XP only (economy)", Icon: CalendarCheck },
      { to: "/owner/health", title: "Database / Ops", desc: "Diagnostics", Icon: Database },
      { to: "/home", title: "User App", desc: "Open as member", Icon: Home },
    ],
  },
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
            <p className="text-[11px] text-white/45">Full menu · open app as member anytime</p>
          </div>
          <Link to="/home" className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-[11px] font-semibold text-amber-300">
            App
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-100">
          {error}
          <p className="mt-2 text-[11px] text-white/50">
            Vercel: TASKORA_OWNER_TELEGRAM_IDS=your_numeric_id → Redeploy → open Mini App.
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

      {SECTIONS.map((sec) => (
        <div key={sec.label} className="mb-5">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">{sec.label}</p>
          <div className="grid grid-cols-2 gap-2.5">
            {sec.items.map(({ to, title, desc, Icon }) => (
              <Link
                key={`${to}-${title}`}
                to={to as "/owner"}
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
        </div>
      ))}
    </main>
  );
}
