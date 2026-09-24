import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ownerGetPayoutPolicy, ownerSetPayoutPolicy } from "@/lib/owner-strong.functions";

export const Route = createFileRoute("/_authenticated/owner/payout-policy")({
  loader: async () => {
    try {
      const policy = await ownerGetPayoutPolicy();
      return { policy, error: null as string | null };
    } catch (e) {
      return {
        policy: null as Awaited<ReturnType<typeof ownerGetPayoutPolicy>> | null,
        error: e instanceof Error ? e.message : "Owner required",
      };
    }
  },
  component: PayoutPolicyPage,
});

function PayoutPolicyPage() {
  const initial = Route.useLoaderData();
  const [policy, setPolicy] = useState(initial.policy);
  const [msg, setMsg] = useState(initial.error);
  const [busy, setBusy] = useState(false);
  const [deny, setDeny] = useState((initial.policy?.country_deny ?? []).join(","));
  const [allow, setAllow] = useState((initial.policy?.country_allow ?? []).join(","));

  if (!policy) {
    return (
      <main className="mx-auto min-h-screen max-w-md bg-[#05070c] px-4 py-6 text-white">
        <h1 className="text-xl font-bold">Payout policy</h1>
        <p className="mt-2 text-sm text-amber-200">{msg ?? "Load failed"}</p>
      </main>
    );
  }

  async function save() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await ownerSetPayoutPolicy({
        data: {
          risk_force_dual: Number(policy!.risk_force_dual),
          risk_auto_freeze: Number(policy!.risk_auto_freeze),
          max_withdrawals_per_day: Number(policy!.max_withdrawals_per_day),
          country_deny: deny
            .split(/[,\s]+/)
            .map((s) => s.trim())
            .filter(Boolean),
          country_allow: allow
            .split(/[,\s]+/)
            .map((s) => s.trim())
            .filter(Boolean),
        },
      });
      setPolicy(r.policy);
      setMsg("Policy saved.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-6 text-white">
      <h1 className="text-xl font-bold">Payout policy</h1>
      <p className="mt-1 text-xs text-white/45">
        Risk thresholds · daily WD cap · country allow/deny. Empty allow list = all countries OK.
      </p>
      {msg ? <p className="mt-3 text-xs text-amber-200">{msg}</p> : null}
      <div className="mt-4 space-y-3">
        <label className="block text-[11px] text-white/50">
          Force dual-approval at risk ≥
          <input
            type="number"
            min={0}
            max={100}
            value={policy.risk_force_dual}
            onChange={(e) => setPolicy({ ...policy, risk_force_dual: Number(e.target.value) })}
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#12141c] px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-[11px] text-white/50">
          Auto-freeze at risk ≥ (0 = off)
          <input
            type="number"
            min={0}
            max={100}
            value={policy.risk_auto_freeze}
            onChange={(e) => setPolicy({ ...policy, risk_auto_freeze: Number(e.target.value) })}
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#12141c] px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-[11px] text-white/50">
          Max WD requests / 24h
          <input
            type="number"
            min={1}
            max={20}
            value={policy.max_withdrawals_per_day}
            onChange={(e) =>
              setPolicy({ ...policy, max_withdrawals_per_day: Number(e.target.value) })
            }
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#12141c] px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-[11px] text-white/50">
          Country deny (ISO, comma-separated)
          <input
            value={deny}
            onChange={(e) => setDeny(e.target.value)}
            placeholder="e.g. XX, YY"
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#12141c] px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-[11px] text-white/50">
          Country allow only (empty = all)
          <input
            value={allow}
            onChange={(e) => setAllow(e.target.value)}
            placeholder="e.g. NG, GH, KE"
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#12141c] px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          onClick={() => void save()}
          className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-3 text-sm font-bold disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save policy"}
        </button>
      </div>
    </main>
  );
}
