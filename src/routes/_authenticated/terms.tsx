import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, FileText, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/terms")({
  head: () => ({ meta: [{ title: "Terms & Conditions — TASKORA" }] }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#030814] px-4 pb-28 pt-4 text-white">
      <header className="mb-5 flex items-center gap-3">
        <Link to="/profile" className="rounded-full border border-cyan-400/20 bg-[#0b1628] p-2 text-slate-300">
          <ChevronLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-black tracking-tight">Terms & Conditions</p>
          <p className="text-[11px] text-slate-400">TaskoraPlus rules and policies</p>
        </div>
        <span className="inline-flex size-10 items-center justify-center rounded-xl border border-cyan-400/30 bg-cyan-500/10 text-cyan-200">
          <FileText className="size-5" />
        </span>
      </header>

      <section className="mb-3 rounded-2xl border border-cyan-400/20 bg-[#0b1628] p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-cyan-300" />
          <div>
            <p className="text-sm font-bold">Using TaskoraPlus</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              By using TaskoraPlus, you agree to follow these rules and any task-specific requirements shown before you participate.
            </p>
          </div>
        </div>
      </section>

      <div className="space-y-3">
        <Section title="1. Accounts">Keep your account information accurate and protect access to your Telegram account. Do not operate duplicate or fraudulent accounts.</Section>
        <Section title="2. Tasks and rewards">Only complete tasks you are genuinely eligible to complete. Rewards are issued after the required server-side checks and may be held or rejected when a task, proof, or transaction cannot be verified.</Section>
        <Section title="3. Withdrawals and deposits">Use the correct crypto asset, network, and destination address. Only send funds to a receiving address that TaskoraPlus explicitly shows as configured. Withdrawal processing may require verification or review.</Section>
        <Section title="4. Prohibited activity">Fraud, automated abuse, recycled submissions, fake engagement, manipulation of task results, multi-account farming, and attempts to bypass verification are prohibited.</Section>
        <Section title="5. Verification and reviews">TaskoraPlus may verify account ownership, task activity, connected accounts, rewards, deposits, withdrawals, referrals, advertisers, and ad providers using server-side records and risk controls.</Section>
        <Section title="6. Advertiser and task rules">Advertisers must provide lawful, accurate task instructions and sufficient funding. TaskoraPlus may pause or reject campaigns that fail platform, verification, or safety requirements.</Section>
        <Section title="7. Changes and enforcement">Rules, reward rates, limits, and supported networks may change as the platform develops. Violations may result in rejected rewards, restricted features, or account suspension following platform review.</Section>
        <Section title="8. Support">If you believe a verification or payment decision is incorrect, contact TaskoraPlus support and provide the relevant transaction, task, or account details for review.</Section>
      </div>

      <p className="mt-5 text-center text-[10px] text-slate-600">TaskoraPlus · Terms & Conditions</p>
    </main>
  );
}

function Section({ title, children }: { title: string; children: string }) {
  return (
    <section className="rounded-2xl border border-white/8 bg-[#0b1628] p-3.5">
      <p className="text-[13px] font-bold text-white">{title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-400">{children}</p>
    </section>
  );
}
