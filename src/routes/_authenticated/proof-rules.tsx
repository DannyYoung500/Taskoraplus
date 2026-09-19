import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ShieldCheck,
  Camera,
  Link2,
  Bot,
  Ban,
  CheckCircle2,
  ChevronLeft,
  AlertTriangle,
} from "lucide-react";
import { BLUE_GRAD } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/proof-rules")({
  component: ProofRulesPage,
});

const RULES = [
  {
    icon: Bot,
    title: "Telegram bot admin (primary)",
    body: "For Telegram join / member tasks, TASKORA verifies membership via getChatMember. Screenshot is secondary only when the bot cannot confirm.",
  },
  {
    icon: Camera,
    title: "Clear screenshots",
    body: "Full-screen captures only. Username, date, and the required action must be visible. Cropped or blurred proofs are rejected.",
  },
  {
    icon: Link2,
    title: "Correct platform only",
    body: "Submit proof from the platform named in the task (YouTube, Instagram, X, Discord, etc.). Cross-platform screenshots are rejected.",
  },
  {
    icon: CheckCircle2,
    title: "Stay joined / subscribed",
    body: "Do not leave or unfollow immediately after submit. Random re-checks may run for 48–72 hours. Early leave = reverse reward + flag.",
  },
  {
    icon: Ban,
    title: "No spam or multi-account",
    body: "One human, one Telegram account. Shared wallets, farm devices, and copy-paste proofs across accounts are auto-flagged.",
  },
  {
    icon: AlertTriangle,
    title: "Minimums & holds",
    body: "Withdrawals: hard floor $3.00, 24h new-account hold, dual owner approval on large amounts. Task rate limit applies to protect quality.",
  },
] as const;

function ProofRulesPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#030814] px-4 pb-28 pt-4 text-white">
      <header className="mb-5 flex items-center gap-3">
        <Link
          to="/profile"
          className="rounded-full border border-cyan-400/20 bg-[#0b1628] p-2 text-slate-300"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-black tracking-tight">Proof standards</p>
          <p className="text-[11px] text-slate-400">Enterprise verification rules</p>
        </div>
        <span className="inline-flex size-10 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 text-cyan-200">
          <ShieldCheck className="size-5" />
        </span>
      </header>

      <section
        className="mb-4 overflow-hidden rounded-2xl border border-cyan-400/25 p-4"
        style={{
          background:
            "radial-gradient(circle at 90% 10%,rgba(56,189,248,0.2),transparent 40%), linear-gradient(145deg,#0a1a33,#050d1a)",
        }}
      >
        <p className="text-sm font-bold text-cyan-100">Why strict proof?</p>
        <p className="mt-1 text-[12px] leading-relaxed text-slate-300">
          TASKORA pays real USDT from a live ledger. Every approval is funded. Clear rules protect
          advertisers, honest taskers, and the treasury.
        </p>
      </section>

      <div className="space-y-3">
        {RULES.map(({ icon: Icon, title, body }) => (
          <article
            key={title}
            className="flex gap-3 rounded-2xl border border-blue-400/15 bg-[#0b1628] p-3.5"
          >
            <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/15 text-cyan-300">
              <Icon className="size-4.5" />
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-white">{title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">{body}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-5 rounded-2xl border border-amber-400/25 bg-amber-400/5 p-3.5">
        <p className="text-[12px] font-bold text-amber-100">Rejected proofs = no pay</p>
        <p className="mt-1 text-[11px] text-slate-400">
          Fake, recycled, or wrong-platform submissions are rejected without reward and may lower
          your risk score. Repeated abuse can suspend withdrawals.
        </p>
      </div>

      <Link
        to="/tasks"
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-full py-3 text-sm font-black text-white shadow-[0_8px_28px_rgba(37,99,235,0.35)]"
        style={{ background: BLUE_GRAD }}
      >
        Browse live tasks
      </Link>
    </main>
  );
}
