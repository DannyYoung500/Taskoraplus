import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Crown,
  LayoutDashboard,
  Send,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import { loadOwnerDashboard } from "@/lib/owner-dashboard.loader";
import { TaskoraLogo } from "@/components/TaskoraLogo";
import { OwnerShell } from "@/components/OwnerShell";
import { ownerSendOpsDigest } from "@/lib/owner-ops.functions";

export const Route = createFileRoute("/_authenticated/owner/")({
  loader: async () => loadOwnerDashboard(),
  component: OwnerHub,
});

const money = (value: unknown) => `$${Number(value ?? 0).toFixed(4)}`;

const NAV = [
  { to: "/owner/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/owner/users", label: "Users", icon: Users },
  { to: "/owner/analytics", label: "Analytics", icon: Activity },
  { to: "/owner/tasks", label: "Tasks", icon: ClipboardCheck },
  { to: "/owner/reviews", label: "Reviews", icon: CheckCircle2 },
  { to: "/owner/withdrawals", label: "Withdrawals", icon: Wallet },
  { to: "/owner/economy", label: "Economy", icon: Settings },
  { to: "/owner/settings", label: "Settings", icon: Settings },
] as const;

function OwnerHub() {
  const { overview, submissions, withdrawals, error } = Route.useLoaderData();
  const o = (overview ?? {}) as Record<string, any>;
  const reviews = Array.isArray(submissions) ? submissions.slice(0, 5) : [];
  const payouts = Array.isArray(withdrawals) ? withdrawals.slice(0, 5) : [];
  const [digestMsg, setDigestMsg] = useState<string | null>(null);
  const [digestBusy, setDigestBusy] = useState(false);

  async function sendDigest() {
    setDigestBusy(true);
    setDigestMsg(null);
    try {
      const r = await ownerSendOpsDigest();
      setDigestMsg(
        `Digest sent · online ${r.online} · new24h ${r.new24h} · WD ${r.pendingWd} · reviews ${r.pendingSub}`,
      );
    } catch (e) {
      setDigestMsg(e instanceof Error ? e.message : "Digest failed");
    } finally {
      setDigestBusy(false);
    }
  }

  const stats = [
    { label: "Users", value: String(o.totalUsers ?? 0), icon: Users, tone: "cyan" },
    { label: "Active 7d", value: String(o.activeUsers ?? 0), icon: Activity, tone: "green" },
    { label: "Pending reviews", value: String(o.pendingReviews ?? 0), icon: ClipboardCheck, tone: "gold" },
    { label: "Pending payouts", value: String(o.pendingWithdrawals ?? 0), icon: Wallet, tone: "purple" },
    { label: "Active tasks", value: String(o.activeTasks ?? 0), icon: ClipboardCheck, tone: "blue" },
    { label: "Rewards paid", value: money(o.rewardsPaid), icon: Wallet, tone: "green" },
    { label: "New 30d", value: String(o.newUsers30d ?? 0), icon: Users, tone: "cyan" },
    { label: "Open fraud", value: String(o.openFraud ?? 0), icon: AlertTriangle, tone: "red" },
  ];

  const toneMap: Record<string, string> = {
    cyan: "bg-cyan-400/10 text-cyan-300 ring-cyan-400/20",
    green: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/20",
    gold: "bg-amber-400/10 text-amber-300 ring-amber-400/20",
    purple: "bg-violet-400/10 text-violet-300 ring-violet-400/20",
    blue: "bg-blue-500/10 text-blue-300 ring-blue-400/20",
    red: "bg-rose-500/10 text-rose-300 ring-rose-400/20",
  };

  return (
    <OwnerShell>
      <div className="min-h-screen bg-[#06101d] text-white">
        <div className="sticky top-0 z-20 border-b border-cyan-400/10 bg-[#071221]/95 px-4 py-3 backdrop-blur-xl">
          <div className="mx-auto flex max-w-5xl items-center gap-3">
            <TaskoraLogo size={40} />
            <div className="min-w-0 flex-1">
              <p className="text-base font-black tracking-tight">Owner</p>
              <p className="text-[10px] text-cyan-300/70">Control Center</p>
            </div>
            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/5 px-2.5 py-1 text-[10px] font-bold text-emerald-300">
              Online
            </span>
            <Crown className="size-4 text-cyan-300" />
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 py-5">
          <nav className="mb-5 flex gap-2 overflow-x-auto pb-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to as any}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-cyan-400/15 bg-white/[0.03] px-3 py-1.5 text-[11px] font-semibold text-slate-300 hover:border-cyan-400/30 hover:text-cyan-200"
              >
                <Icon className="size-3.5 text-cyan-400/80" />
                {label}
              </Link>
            ))}
          </nav>

          {error ? (
            <div className="mb-4 rounded-2xl border border-amber-400/25 bg-amber-400/5 px-4 py-3 text-sm text-amber-100">
              {error}
            </div>
          ) : null}

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {stats.map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.label}
                  className="rounded-2xl border border-cyan-400/10 bg-gradient-to-br from-[#0b1b30] to-[#071321] p-3.5"
                >
                  <div className={`flex size-8 items-center justify-center rounded-full ring-1 ${toneMap[s.tone]}`}>
                    <Icon className="size-3.5" />
                  </div>
                  <p className="mt-2.5 text-[10px] font-medium text-slate-400">{s.label}</p>
                  <p className="mt-0.5 truncate text-lg font-black tabular-nums text-white">{s.value}</p>
                </div>
              );
            })}
          </section>

          <section className="mt-5">
            <h2 className="mb-2 text-sm font-black">Quick actions</h2>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["/owner/reviews", "Review tasks", ClipboardCheck],
                ["/owner/withdrawals", "Payouts", Wallet],
                ["/owner/users", "Users", Users],
                ["/owner/economy", "Economy", Settings],
              ].map(([to, title, Icon]) => (
                <Link
                  key={title as string}
                  to={to as any}
                  className="flex items-center gap-2.5 rounded-xl border border-blue-400/10 bg-blue-500/[0.06] p-3 hover:border-cyan-400/25"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-300">
                    <Icon className="size-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 text-[11px] font-bold">{title as string}</span>
                  <ChevronRight className="size-3.5 text-cyan-400/50" />
                </Link>
              ))}
            </div>
          </section>

          <section className="mt-5 grid gap-4 sm:grid-cols-2">
            <QueueCard
              title="Task reviews"
              href="/owner/reviews"
              empty="No pending reviews"
              rows={reviews.map((r: any) => ({
                id: r.id,
                primary: r.profiles?.username ?? r.profiles?.display_name ?? "User",
                secondary: r.tasks?.title ?? "Task",
                meta: money(r.tasks?.reward),
              }))}
            />
            <QueueCard
              title="Withdrawals"
              href="/owner/withdrawals"
              empty="No pending withdrawals"
              rows={payouts.map((r: any) => ({
                id: r.id,
                primary: r.profiles?.username ?? r.profiles?.display_name ?? "User",
                secondary: String(r.method ?? "USDT"),
                meta: money(r.amount),
              }))}
            />
          </section>

          <section className="mt-5 rounded-2xl border border-cyan-400/10 bg-[#08172a] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black">System</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
                  <CheckCircle2 className="size-3.5" /> Operational
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
                <span className="rounded-full bg-white/[0.04] px-2.5 py-1">DB · OK</span>
                <span className="rounded-full bg-white/[0.04] px-2.5 py-1">API · OK</span>
                <span className="rounded-full bg-white/[0.04] px-2.5 py-1">Bot · OK</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={digestBusy}
                  onClick={() => void sendDigest()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/25 bg-violet-500/10 px-3 py-2 text-[11px] font-bold text-violet-200 disabled:opacity-50"
                >
                  <Send className="size-3.5" />
                  {digestBusy ? "Sending…" : "Ops digest"}
                </button>
                <Link
                  to="/owner/settings"
                  className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-[11px] font-bold text-cyan-200"
                >
                  Settings
                </Link>
              </div>
            </div>
            {digestMsg ? (
              <p className="mt-3 text-[11px] text-violet-200/90">{digestMsg}</p>
            ) : null}
          </section>
        </div>
      </div>
    </OwnerShell>
  );
}

function QueueCard({
  title,
  href,
  empty,
  rows,
}: {
  title: string;
  href: string;
  empty: string;
  rows: { id: string; primary: string; secondary: string; meta: string }[];
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-cyan-400/10 bg-[#08172a]">
      <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3">
        <h2 className="text-sm font-black">{title}</h2>
        <Link to={href as any} className="text-[10px] font-bold text-cyan-300">
          View all
        </Link>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {rows.length === 0 ? (
          <p className="px-4 py-8 text-center text-[11px] text-slate-500">{empty}</p>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="flex items-center gap-3 px-4 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold text-cyan-100">{row.primary}</p>
                <p className="truncate text-[10px] text-slate-500">{row.secondary}</p>
              </div>
              <p className="shrink-0 text-[11px] font-bold tabular-nums text-white">{row.meta}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
