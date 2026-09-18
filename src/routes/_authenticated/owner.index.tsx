import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  CreditCard,
  Crown,
  Database,
  FileText,
  Gamepad2,
  LayoutDashboard,
  LifeBuoy,
  Megaphone,
  PlayCircle,
  Settings,
  ShieldAlert,
  SlidersHorizontal,
  UserCog,
  Users,
  Wallet,
  Webhook,
  XCircle,
} from "lucide-react";
import { ownerListSubmissions, ownerOverview, ownerWithdrawals } from "@/lib/owner.functions";
import { TaskoraLogo } from "@/components/TaskoraLogo";
import { OwnerShell } from "@/components/OwnerShell";

export const Route = createFileRoute("/_authenticated/owner/")({
  loader: async () => {
    try {
      const [overview, submissions, withdrawals] = await Promise.all([
        ownerOverview(),
        ownerListSubmissions({ status: "pending" }),
        ownerWithdrawals({ status: "pending" }),
      ]);
      return { overview, submissions, withdrawals, error: null as string | null };
    } catch (e) {
      return {
        overview: null,
        submissions: [],
        withdrawals: [],
        error: e instanceof Error ? e.message : "Owner access required",
      };
    }
  },
  component: OwnerHub,
});

const money = (value: unknown) => `$${Number(value ?? 0).toFixed(4)}`;

const sideSections = [
  {
    label: "Users & Management",
    items: [
      ["Users & Wallets", "/owner/users", Users],
      ["KYC Verification", "/owner/users", UserCog],
      ["User Logs", "/owner/audit", FileText],
      ["Suspensions & Bans", "/owner/users", ShieldAlert],
    ],
  },
  {
    label: "Tasks & Campaigns",
    items: [
      ["Tasks", "/owner/tasks", ClipboardCheck],
      ["Task Reviews", "/owner/reviews", CheckCircle2],
      ["Campaigns", "/owner/campaigns", Megaphone],
      ["Task Categories", "/owner/tasks", SlidersHorizontal],
    ],
  },
  {
    label: "Financial",
    items: [
      ["Withdrawals", "/owner/withdrawals", Wallet],
      ["Deposits", "/owner/deposits", CreditCard],
      ["Transactions", "/owner/ledger", FileText],
      ["Ledger", "/owner/ledger", Activity],
      ["Payment Settings", "/owner/payment-settings", CreditCard],
    ],
  },
  {
    label: "Providers & Integrations",
    items: [
      ["Provider Control Center", "/owner/monetization", SlidersHorizontal],
      ["Games / Providers", "/owner/monetization", Gamepad2],
      ["Video Providers", "/owner/videos", PlayCircle],
      ["Rewarded Ads", "/owner/monetization", Megaphone],
      ["API Integrations", "/owner/connected", Webhook],
    ],
  },
  {
    label: "Risk & Analytics",
    items: [
      ["Fraud & Risk", "/owner/fraud", ShieldAlert],
      ["Analytics", "/owner/analytics", BarChart3],
      ["Leaderboard", "/owner/analytics", Crown],
      ["System Health", "/owner/health", Activity],
    ],
  },
  {
    label: "Platform",
    items: [
      ["Notifications", "/owner/announce", Bell],
      ["Advertisements", "/advertise", Megaphone],
      ["Announcements", "/owner/announce", Bell],
      ["Settings", "/owner/settings", Settings],
      ["Roles & Permissions", "/owner/roles", UserCog],
      ["Audit Logs", "/owner/audit", FileText],
      ["Maintenance Mode", "/owner/settings", Settings],
    ],
  },
] as const;

function OwnerHub() {
  const { overview, submissions, withdrawals, error } = Route.useLoaderData();
  const o = overview as Record<string, any> | null;
  const reviews = (submissions as any[]).slice(0, 4);
  const payoutRows = (withdrawals as any[]).slice(0, 4);
  const chart = Array.isArray(o?.charts?.userGrowth) ? o.charts.userGrowth : [];
  const maxChart = Math.max(1, ...chart.map((x: any) => Number(x.value ?? 0)));
  const points = chart
    .map((x: any, i: number) => {
      const xPos = chart.length <= 1 ? 50 : (i / (chart.length - 1)) * 100;
      const yPos = 92 - (Number(x.value ?? 0) / maxChart) * 72;
      return `${xPos.toFixed(2)},${yPos.toFixed(2)}`;
    })
    .join(" ");

  const stats = [
    { label: "Total Users", value: String(o?.totalUsers ?? 0), delta: "0%", note: "vs last 30 days", icon: Users, tone: "cyan" },
    { label: "Active (7d)", value: String(o?.activeUsers ?? 0), delta: "0%", note: "vs last 7 days", icon: Users, tone: "green" },
    { label: "Pending Reviews", value: String(o?.pendingReviews ?? 0), delta: o?.pendingReviews ? "100%" : "0%", note: "vs last 7 days", icon: ClipboardCheck, tone: "gold" },
    { label: "Pending Payouts", value: String(o?.pendingWithdrawals ?? 0), delta: "0%", note: "vs last 7 days", icon: Wallet, tone: "purple" },
    { label: "Active Tasks", value: String(o?.activeTasks ?? 0), delta: "0%", note: "vs last 7 days", icon: ClipboardCheck, tone: "blue" },
    { label: "Rewards Paid", value: money(o?.rewardsPaid), delta: "0%", note: "vs last 30 days", icon: Wallet, tone: "green" },
    { label: "Open Fraud", value: String(o?.openFraud ?? 0), delta: "0%", note: "vs last 7 days", icon: AlertTriangle, tone: "red" },
    { label: "New (30d)", value: String(o?.newUsers30d ?? 0), delta: "0%", note: "vs last 30 days", icon: Users, tone: "cyan" },
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
        <div className="sticky top-0 z-20 border-b border-cyan-400/10 bg-[#071221]/95 px-4 py-3 backdrop-blur-xl lg:px-6">
          <div className="flex items-center gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <TaskoraLogo size={48} />
              <div className="min-w-0">
                <p className="text-lg font-black tracking-tight text-white">TASKORA</p>
                <p className="text-[8px] font-bold uppercase tracking-[0.28em] text-cyan-300/70">Earn · Play · Grow</p>
              </div>
            </div>
            <div className="hidden h-9 w-px bg-white/10 lg:block" />
            <div className="hidden items-center gap-2 text-cyan-200/80 lg:flex">
              <LayoutDashboard className="size-4" />
              <span className="text-xs font-semibold">Owner Control Center</span>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden rounded-full border border-emerald-400/20 bg-emerald-400/5 px-3 py-1 text-[10px] font-bold text-emerald-300 sm:inline-flex">
                ● System Online
              </span>
              <Bell className="size-5 text-white/55" />
              <div className="hidden items-center gap-2 sm:flex">
                <span className="text-right text-[10px] font-semibold text-white/80">Owner<br /><span className="font-normal text-white/35">Admin</span></span>
                <Crown className="size-4 text-cyan-300" />
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto flex max-w-[1600px]">
          <aside className="hidden w-60 shrink-0 border-r border-cyan-400/10 bg-[#061321] px-3 py-4 lg:block">
            <Link to="/owner/" className="mb-4 flex items-center gap-2 rounded-xl border border-cyan-400/20 bg-blue-500/20 px-3 py-2.5 text-xs font-bold text-white shadow-[inset_3px_0_0_#22d3ee]">
              <LayoutDashboard className="size-4 text-cyan-300" /> Dashboard
            </Link>
            <nav className="space-y-4">
              {sideSections.map((section) => (
                <div key={section.label}>
                  <p className="mb-1.5 px-2 text-[8px] font-black uppercase tracking-[0.16em] text-cyan-300/55">{section.label}</p>
                  <div className="space-y-0.5">
                    {section.items.map(([label, to, Icon]) => (
                      <Link key={label} to={to as any} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[10px] font-medium text-slate-300/75 transition hover:bg-white/[0.04] hover:text-cyan-200">
                        <Icon className="size-3.5 shrink-0 text-cyan-300/75" /> {label}
                        {(label === "Task Reviews" && Number(o?.pendingReviews ?? 0) > 0) ? <span className="ml-auto rounded-full bg-rose-500 px-1.5 py-0.5 text-[8px] font-black">{o?.pendingReviews}</span> : null}
                        {(label === "Withdrawals" && Number(o?.pendingWithdrawals ?? 0) > 0) ? <span className="ml-auto rounded-full bg-rose-500 px-1.5 py-0.5 text-[8px] font-black">{o?.pendingWithdrawals}</span> : null}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          <main className="min-w-0 flex-1 px-4 py-5 lg:px-6 lg:py-6">
            <div className="mb-5 flex flex-wrap items-end gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <TaskoraLogo size={38} />
                  <div>
                    <h1 className="text-xl font-black tracking-tight sm:text-2xl">Owner Dashboard</h1>
                    <p className="text-[10px] text-cyan-300/70">Control Center · Monitor · Manage · Grow</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-cyan-400/10 bg-white/[0.02] px-3 py-2 text-[10px] text-slate-400">Live data</div>
            </div>

            {error ? (
              <div className="mb-4 rounded-2xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm text-amber-100">{error}</div>
            ) : null}

            <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {stats.map((s) => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="rounded-2xl border border-cyan-400/10 bg-gradient-to-br from-[#0b1b30] to-[#071321] p-4 shadow-[0_12px_30px_rgba(0,0,0,.18)]">
                    <div className="flex items-start justify-between gap-2">
                      <div className={`flex size-9 items-center justify-center rounded-full ring-1 ${toneMap[s.tone]}`}><Icon className="size-4" /></div>
                    </div>
                    <p className="mt-3 text-[10px] font-medium text-slate-400">{s.label}</p>
                    <p className="mt-0.5 truncate text-xl font-black tabular-nums text-white">{s.value}</p>
                    <p className={`mt-1 text-[10px] font-bold ${s.tone === "red" ? "text-rose-300" : "text-emerald-300"}`}>↗ {s.delta}</p>
                    <p className="text-[8px] text-slate-500">{s.note}</p>
                  </div>
                );
              })}
            </section>

            <section className="mt-4 grid gap-4 xl:grid-cols-[1.65fr_1fr]">
              <div className="rounded-2xl border border-cyan-400/10 bg-[#08172a] p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-black">User Growth</h2>
                  <div className="flex gap-4 text-[9px] text-slate-400"><span>● Total Users</span><span className="text-emerald-300">● Active Users</span></div>
                </div>
                <div className="h-44 overflow-hidden rounded-xl bg-[#061426]">
                  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
                    {[20, 40, 60, 80].map((y) => <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="rgba(34,211,238,.08)" strokeWidth=".5" />)}
                    <polyline fill="none" stroke="currentColor" className="text-cyan-400" strokeWidth="1.2" points={points || "0,92 100,92"} />
                    <polyline fill="rgba(16,185,129,.08)" stroke="currentColor" className="text-emerald-400" strokeWidth=".8" points={points || "0,92 100,92"} />
                  </svg>
                </div>
                <div className="mt-2 flex justify-between text-[8px] text-slate-500">
                  <span>{chart[0]?.day ?? "—"}</span><span>{chart[Math.floor(chart.length / 2)]?.day ?? "—"}</span><span>{chart[chart.length - 1]?.day ?? "—"}</span>
                </div>
              </div>

              <div className="rounded-2xl border border-cyan-400/10 bg-[#08172a] p-4">
                <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-black">Recent Activity</h2><Link to="/owner/audit" className="text-[9px] font-bold text-cyan-300">View All</Link></div>
                <div className="space-y-2">
                  {(o?.recentActivity ?? []).slice(0, 6).map((a: any, i: number) => (
                    <div key={a.id ?? i} className="flex items-center gap-2 border-b border-white/[0.05] pb-2">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-300"><Activity className="size-3.5" /></span>
                      <div className="min-w-0 flex-1"><p className="truncate text-[10px] font-semibold text-slate-200">{a.action ?? "Owner activity"}</p><p className="text-[8px] text-slate-500">{a.admin_label ?? "System"} · {a.created_at ? new Date(a.created_at).toLocaleString() : "—"}</p></div>
                    </div>
                  ))}
                  {!o?.recentActivity?.length ? <p className="py-8 text-center text-[10px] text-slate-500">No recent activity.</p> : null}
                </div>
              </div>
            </section>

            <section className="mt-4 rounded-2xl border border-cyan-400/10 bg-[#08172a] p-3">
              <h2 className="mb-2 px-1 text-sm font-black">Quick Actions</h2>
              <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
                {[
                  ["/owner/reviews", "Review Tasks", "Approve/reject pending proofs", ClipboardCheck],
                  ["/owner/withdrawals", "Manage Withdrawals", "Mark paid or reject requests", Wallet],
                  ["/owner/campaigns", "Create Campaign", "Publish new task/campaign", Megaphone],
                  ["/owner/users", "Manage Users", "Search, suspend, adjust balances", Users],
                ].map(([to, title, desc, Icon]) => (
                  <Link key={title as string} to={to as any} className="group flex items-center gap-3 rounded-xl border border-blue-400/10 bg-blue-500/[0.06] p-3 hover:border-cyan-400/25">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-500/15 text-blue-300"><Icon className="size-4" /></span>
                    <span className="min-w-0 flex-1"><p className="text-[10px] font-bold">{title as string}</p><p className="truncate text-[8px] text-slate-500">{desc as string}</p></span>
                    <ChevronRight className="size-4 text-cyan-400/60" />
                  </Link>
                ))}
              </div>
            </section>

            <section className="mt-4 grid gap-4 xl:grid-cols-2">
              <Queue title="Task Review Queue" href="/owner/reviews" empty="No pending task reviews." columns={["User", "Task", "Reward", "Submitted"]}>
                {reviews.map((r: any) => <QueueRow key={r.id} values={[r.profiles?.username ?? r.profiles?.display_name ?? "User", r.tasks?.title ?? "Task", money(r.tasks?.reward), r.created_at ? new Date(r.created_at).toLocaleString() : "—"]} actions={<><Link to="/owner/reviews" className="rounded-md bg-emerald-500 px-2 py-1 text-[8px] font-bold">Approve</Link><Link to="/owner/reviews" className="rounded-md bg-rose-500 px-2 py-1 text-[8px] font-bold">Reject</Link></>} />)}
              </Queue>
              <Queue title="Withdrawal Queue" href="/owner/withdrawals" empty="No pending withdrawals." columns={["User", "Amount", "Method", "Status"]}>
                {payoutRows.map((r: any) => <QueueRow key={r.id} values={[r.profiles?.username ?? r.profiles?.display_name ?? "User", money(r.amount), String(r.method ?? "USDT"), String(r.status ?? "pending")]} actions={<><Link to="/owner/withdrawals" className="rounded-md bg-blue-500 px-2 py-1 text-[8px] font-bold">Manage</Link><Link to="/owner/withdrawals" className="rounded-md bg-rose-500 px-2 py-1 text-[8px] font-bold">Reject</Link></>} />)}
              </Queue>
            </section>

            <section className="mt-4 grid gap-4 xl:grid-cols-[1.2fr_1fr_1fr]">
              <div className="rounded-2xl border border-cyan-400/10 bg-[#08172a] p-4">
                <h2 className="mb-3 text-sm font-black">System Settings</h2>
                <div className="grid grid-cols-2 gap-3 text-[9px]">
                  <Setting label="Minimum Withdrawal" value="$10.0000" href="/owner/settings" />
                  <Setting label="Referral Commission" value="10% USD + Task Points" href="/owner/settings" />
                  <Setting label="Task Earning Rate" value="Owner controlled" href="/owner/settings" />
                  <Setting label="KYC Amount" value="Owner controlled" href="/owner/settings" />
                  <Setting label="Watch Video Price" value="USDT" href="/owner/videos" />
                  <Setting label="Daily Check-in" value="Task Points" href="/owner/settings" />
                </div>
              </div>
              <div className="rounded-2xl border border-cyan-400/10 bg-[#08172a] p-4">
                <h2 className="mb-3 text-sm font-black">Platform Health</h2>
                <p className="mb-3 flex items-center gap-2 text-[10px] font-bold text-emerald-300"><CheckCircle2 className="size-4" /> All Systems Operational</p>
                <div className="grid grid-cols-2 gap-2 text-[9px] text-slate-400">
                  <HealthItem label="Database" ok /><HealthItem label="API Services" ok /><HealthItem label="Telegram Bot" ok={Boolean(typeof window === "undefined" ? true : true)} /><HealthItem label="Payment Gateway" ok={false} /><HealthItem label="Provider Integrations" ok={false} /><HealthItem label="Webhooks" ok={false} />
                </div>
                <Link to="/owner/health" className="mt-4 block text-right text-[9px] font-bold text-cyan-300">View Details</Link>
              </div>
              <div className="rounded-2xl border border-cyan-400/10 bg-[#08172a] p-4">
                <h2 className="mb-3 text-sm font-black">Quick Stats</h2>
                <div className="space-y-2 text-[9px]">
                  <QuickStat label="Total Revenue" value={money(o?.platformRevenue)} />
                  <QuickStat label="Total Payouts" value={money(o?.withdrawalsPaid)} />
                  <QuickStat label="Active Campaigns" value={String(o?.activeCampaigns ?? 0)} />
                  <QuickStat label="Total Transactions" value={String((o?.recentActivity ?? []).length)} />
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </OwnerShell>
  );
}

function Queue({ title, href, empty, columns, children }: { title: string; href: string; empty: string; columns: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-cyan-400/10 bg-[#08172a]">
      <div className="flex items-center justify-between border-b border-white/[0.05] px-4 py-3"><h2 className="text-sm font-black">{title}</h2><Link to={href as any} className="text-[9px] font-bold text-cyan-300">View All</Link></div>
      <div className="hidden grid-cols-[1.05fr_1.5fr_.65fr_1fr_1.4fr] gap-2 border-b border-white/[0.05] px-4 py-2 text-[8px] font-bold uppercase text-slate-500 sm:grid">{columns.map((c) => <span key={c}>{c}</span>)}<span>Action</span></div>
      <div>{children}</div>
    </div>
  );
}
function QueueRow({ values, actions }: { values: string[]; actions: React.ReactNode }) {
  return <div className="grid gap-1 border-b border-white/[0.04] px-4 py-2.5 text-[9px] sm:grid-cols-[1.05fr_1.5fr_.65fr_1fr_1.4fr] sm:items-center sm:gap-2"><div className="font-semibold text-cyan-200">{values[0]}</div><div className="truncate text-slate-300">{values[1]}</div><div className="text-white">{values[2]}</div><div className="text-slate-500">{values[3]}</div><div className="flex gap-1">{actions}</div></div>;
}
function Setting({ label, value, href }: { label: string; value: string; href: string }) {
  return <Link to={href as any} className="rounded-lg border border-white/[0.04] bg-white/[0.02] p-2 hover:border-cyan-400/15"><p className="text-slate-500">{label}</p><p className="mt-0.5 font-bold text-slate-200">{value}</p></Link>;
}
function HealthItem({ label, ok }: { label: string; ok: boolean }) {
  return <div className="flex items-center gap-1.5"><span className={`size-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-rose-400"}`} />{label}</div>;
}
function QuickStat({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between border-b border-white/[0.04] pb-2"><span className="text-slate-500">{label}</span><span className="font-bold text-white">{value}</span></div>;
}
