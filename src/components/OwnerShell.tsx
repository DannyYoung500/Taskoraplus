import { useMemo, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  BarChart3,
  HeartPulse,
  Users,
  ListChecks,
  Landmark,
  ClipboardCheck,
  Link2,
  Wallet,
  ArrowDownCircle,
  BookOpen,
  Coins,
  ShieldAlert,
  Megaphone,
  LifeBuoy,
  Bell,
  Lock,
  Shield,
  ScrollText,
  Settings,
  CreditCard,
  PlayCircle,
  Home,
  Search,
  X,
  Menu,
  SlidersHorizontal,
  MessageSquareHeart,
  Flag,
  Gamepad2,
} from "lucide-react";
import { TASKORA_LOGO } from "@/lib/brand";

type Item = { to: string; title: string; Icon: typeof Users };

const SECTIONS: { label: string; items: Item[] }[] = [
  {
    label: "Overview",
    items: [
      { to: "/owner", title: "Command Center", Icon: LayoutDashboard },
      { to: "/owner/analytics", title: "Analytics", Icon: BarChart3 },
      { to: "/owner/health", title: "System Health", Icon: HeartPulse },
    ],
  },
  {
    label: "People & Work",
    items: [
      { to: "/owner/users", title: "Users", Icon: Users },
      { to: "/owner/tasks", title: "Tasks", Icon: ListChecks },
      { to: "/owner/campaigns", title: "Campaigns", Icon: Landmark },
      { to: "/owner/reviews", title: "Task Review", Icon: ClipboardCheck },
      { to: "/owner/connected", title: "Connected Accounts", Icon: Link2 },
      { to: "/owner/tickets", title: "Support", Icon: LifeBuoy },
    ],
  },
  {
    label: "Money",
    items: [
      { to: "/owner/withdrawals", title: "Withdrawals", Icon: Wallet },
      { to: "/owner/deposits", title: "Deposits", Icon: ArrowDownCircle },
      { to: "/owner/ledger", title: "Ledger", Icon: BookOpen },
      { to: "/owner/settings", title: "Economy · Gate · Webhook", Icon: Coins },
      { to: "/owner/economy", title: "Platform Prices", Icon: Coins },
      { to: "/owner/fraud", title: "Fraud & Risk", Icon: ShieldAlert },
      { to: "/owner/payment-settings", title: "Payment Settings", Icon: CreditCard },
    ],
  },
  {
    label: "Monetization",
    items: [
      { to: "/owner/monetization", title: "Providers", Icon: SlidersHorizontal },
      { to: "/owner/videos", title: "Watch & Earn", Icon: PlayCircle },
      { to: "/owner/games", title: "Games Marketplace", Icon: Gamepad2 },
      { to: "/advertise", title: "Publish Task", Icon: Megaphone },
    ],
  },
  {
    label: "Growth & Comms",
    items: [
      { to: "/owner/welcome", title: "Bot /start Welcome", Icon: MessageSquareHeart },
      { to: "/owner/announce", title: "Broadcast", Icon: Bell },
    ],
  },
  {
    label: "System",
    items: [
      { to: "/owner/settings", title: "Telegram Gate · Webhook", Icon: Lock },
      { to: "/owner/roles", title: "Roles", Icon: Shield },
      { to: "/owner/flags", title: "Flags", Icon: Flag },
      { to: "/owner/audit", title: "Audit Log", Icon: ScrollText },
      { to: "/owner/documents", title: "Documents", Icon: Settings },
      { to: "/home", title: "User App", Icon: Home },
    ],
  },
];

const LIME = "#a3e635";

export function OwnerShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return SECTIONS;
    return SECTIONS.map((sec) => ({
      ...sec,
      items: sec.items.filter((i) => i.title.toLowerCase().includes(term)),
    })).filter((sec) => sec.items.length > 0);
  }, [q]);

  function isActive(to: string) {
    if (to === "/owner") return pathname === "/owner" || pathname === "/owner/";
    return pathname === to || pathname.startsWith(`${to}/`);
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md bg-[#0b1424] text-slate-100">
      {open ? (
        <aside className="fixed inset-y-0 left-0 z-50 flex w-[min(100%,300px)] flex-col border-r border-white/10 bg-[#0a1220] shadow-2xl">
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-3">
            <img src={TASKORA_LOGO} alt="" className="size-8 rounded-full object-cover ring-1 ring-lime-400/40" />
            <span className="flex-1 text-sm font-extrabold tracking-wide" style={{ color: LIME }}>
              TASKORA →
            </span>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="px-3 py-2">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-[#121f33] px-3 py-2.5">
              <Search className="size-3.5 text-slate-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filter menu..."
                className="w-full bg-transparent text-sm text-slate-200 outline-none placeholder:text-slate-500"
              />
            </div>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 pb-10 pt-1">
            {filtered.map((sec) => (
              <div key={sec.label} className="mb-3">
                <p className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {sec.label}
                </p>
                <ul className="space-y-0.5">
                  {sec.items.map((item) => {
                    const active = isActive(item.to);
                    const Icon = item.Icon;
                    return (
                      <li key={`${item.to}-${item.title}`}>
                        <Link
                          to={item.to as "/owner"}
                          onClick={() => setOpen(false)}
                          className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${
                            active
                              ? "font-semibold text-[#0b1424]"
                              : "text-slate-300 hover:bg-white/5"
                          }`}
                          style={active ? { background: LIME } : undefined}
                        >
                          <Icon className="size-4 shrink-0 opacity-90" />
                          <span className="truncate">{item.title}</span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </aside>
      ) : null}

      {open ? (
        <button
          type="button"
          aria-label="Close"
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="relative flex min-h-screen w-full flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-2 border-b border-white/10 bg-[#0b1424]/95 px-3 py-3 backdrop-blur">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setOpen(true)}
            className="rounded-xl border border-white/10 bg-[#121f33] p-2 text-slate-200"
          >
            <Menu className="size-4" />
          </button>
          <img src={TASKORA_LOGO} alt="" className="size-7 rounded-full object-cover ring-1 ring-sky-400/30" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-blue-400">Owner</p>
            <p className="truncate text-sm font-bold">Command Center</p>
          </div>
          <Link
            to="/home"
            className="rounded-full border border-blue-400/30 bg-blue-500/10 px-3 py-1.5 text-[11px] font-semibold text-blue-300"
          >
            App
          </Link>
        </header>
        <div className="flex-1 pb-10">{children}</div>
      </div>
    </div>
  );
}
