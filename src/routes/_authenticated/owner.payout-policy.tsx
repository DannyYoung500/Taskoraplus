import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ownerGetPayoutPolicy,
  ownerSetPayoutPolicy,
  ownerGetPayoutChannel,
  ownerSetPayoutChannel,
} from "@/lib/owner-payout-policy.functions";

export const Route = createFileRoute("/_authenticated/owner/payout-policy")({
  loader: async () => {
    try {
      const [policy, channel] = await Promise.all([
        ownerGetPayoutPolicy(),
        ownerGetPayoutChannel().catch(() => ({ channel_id: "" })),
      ]);
      return { policy, channelId: channel.channel_id ?? "", error: null as string | null };
    } catch (e) {
      return {
        policy: null as Awaited<ReturnType<typeof ownerGetPayoutPolicy>> | null,
        channelId: "",
        error: e instanceof Error ? e.message : "Owner required",
      };
    }
  },
  component: PayoutPolicyPage,
});

function PayoutPolicyPage() {
  const initial = Route.useLoaderData();
  const [policy, setPolicy] = useState(initial.policy);
  const [channelId, setChannelId] = useState(initial.channelId ?? "");
  const [msg, setMsg] = useState(initial.error);
  const [busy, setBusy] = useState(false);
  const [channelBusy, setChannelBusy] = useState(false);
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

  async function saveChannel() {
    setChannelBusy(true);
    setMsg(null);
    try {
      const r = await ownerSetPayoutChannel({ data: { channel_id: channelId.trim() } });
      setChannelId(r.channel_id ?? "");
      setMsg(
        r.channel_id
          ? "Payment channel saved. Every paid withdrawal will post proof there."
          : "Payment channel cleared.",
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Channel save failed");
    } finally {
      setChannelBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-6 text-white">
      <h1 className="text-xl font-bold">Payout policy</h1>
      <p className="mt-1 text-xs text-white/45">
        Risk thresholds · daily WD cap · country allow/deny · public payment channel proof.
      </p>
      {msg ? <p className="mt-3 text-xs text-amber-200">{msg}</p> : null}

      {/* Payment / proof channel */}
      <section className="mt-5 rounded-2xl border border-cyan-500/25 bg-[#0a121c] p-4">
        <h2 className="text-sm font-semibold text-cyan-200">Payment channel (payout proof)</h2>
        <p className="mt-1 text-[11px] text-white/45">
          Every time you mark a withdrawal <b>Paid</b>, TASKORA posts a public proof message here
          (amount, network, short address, tx hash + explorer link). Bot must be admin of the
          channel.
        </p>
        <label className="mt-3 block text-[11px] text-white/50">
          Channel ID or @username
          <input
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            placeholder="-100xxxxxxxxxx or @YourPaymentChannel"
            className="mt-1 w-full rounded-xl border border-white/10 bg-[#12141c] px-3 py-2 text-sm font-mono"
          />
        </label>
        <p className="mt-1 text-[10px] text-white/35">
          Tip: forward a channel message to @userinfobot to get the numeric id. Env override:{" "}
          <code className="text-cyan-300/80">TASKORA_PAYOUT_CHANNEL_ID</code>
        </p>
        <button
          type="button"
          disabled={channelBusy}
          onClick={() => void saveChannel()}
          className="mt-3 w-full rounded-xl border border-cyan-400/40 bg-cyan-500/15 py-2.5 text-sm font-semibold text-cyan-100 disabled:opacity-50"
        >
          {channelBusy ? "Saving…" : "Save payment channel"}
        </button>
      </section>

      <div className="mt-5 space-y-3">
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
