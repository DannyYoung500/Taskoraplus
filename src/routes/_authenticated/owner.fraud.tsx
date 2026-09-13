import { createFileRoute } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";

export const Route = createFileRoute("/_authenticated/owner/fraud")({
  component: OwnerFraud,
});

/**
 * Fraud module UI — flags require fraud_flags table (SQL migration).
 * Strong recommended signals for TASKORA operations.
 */
function OwnerFraud() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <ShieldAlert className="size-5 text-amber-300" /> Fraud & risk
      </h1>
      <p className="mt-1 text-xs text-white/45">
        Recommended controls for rewards platforms (apply when SQL tables exist).
      </p>

      <div className="mt-4 space-y-3">
        {[
          {
            t: "Duplicate wallet addresses",
            d: "Flag users who share the same USDT/TON payout address across accounts.",
          },
          {
            t: "Velocity limits",
            d: "Cap task submissions per hour and withdrawals per day per Telegram ID.",
          },
          {
            t: "New account hold",
            d: "Delay first withdrawal 24–48h after signup or after first verified task.",
          },
          {
            t: "Proof quality queue",
            d: "Auto-route screenshot tasks with low text variance to manual review.",
          },
          {
            t: "Referral abuse",
            d: "Block self-referral loops and same-device invite rings when device signals exist.",
          },
          {
            t: "Risk score",
            d: "Score 0–100 from pending rejects, multi-account, and rapid withdraw attempts.",
          },
        ].map((x) => (
          <div key={x.t} className="rounded-2xl border border-white/8 bg-[#12141c] p-4">
            <p className="text-sm font-semibold text-amber-200">{x.t}</p>
            <p className="mt-1 text-xs text-white/50">{x.d}</p>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[11px] text-white/40">
        Live flag list appears after `fraud_flags` + audit tables are applied via SQL. Open flags will
        show on the Owner hub KPI when available.
      </p>
    </main>
  );
}
