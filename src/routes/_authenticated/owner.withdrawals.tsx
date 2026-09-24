import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { reviewWithdrawal } from "@/lib/taskora-extra.functions";
import { listPendingWithdrawalsWithRisk, ownerSetWalletFrozen } from "@/lib/owner-strong.functions";

export const Route = createFileRoute("/_authenticated/owner/withdrawals")({
  loader: async () => {
    try {
      const rows = await listPendingWithdrawalsWithRisk();
      return { rows, error: null as string | null };
    } catch (e) {
      return {
        rows: [] as Awaited<ReturnType<typeof listPendingWithdrawalsWithRisk>>,
        error: e instanceof Error ? e.message : "Owner access required",
      };
    }
  },
  component: OwnerWithdrawals,
});

type WdRow = Awaited<ReturnType<typeof listPendingWithdrawalsWithRisk>>[number] & {
  requires_dual?: boolean;
  approval_stage?: string;
  first_approved_by?: string | null;
  risk_score?: number | null;
  risk_signals?: string[];
  presence_label?: string;
  country_line?: string;
  wallet_frozen?: boolean;
};

function riskColor(score: number | null | undefined) {
  if (score == null) return "text-white/40";
  if (score >= 70) return "text-red-300";
  if (score >= 40) return "text-amber-300";
  return "text-emerald-300";
}

function OwnerWithdrawals() {
  const initial = Route.useLoaderData();
  const [rows, setRows] = useState((initial.rows ?? []) as WdRow[]);
  const [error, setError] = useState(initial.error);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [txHashes, setTxHashes] = useState<Record<string, string>>({});

  async function act(id: string, decision: "paid" | "rejected" | "first_approve") {
    setBusyId(id);
    setError(null);
    try {
      const txHash = decision === "paid" ? (txHashes[id] || "").trim() || undefined : undefined;
      await reviewWithdrawal({
        data: { withdrawalId: id, decision, txHash },
      });
      if (decision === "first_approve") {
        setRows((prev) =>
          prev.map((row) =>
            row.id === id ? { ...row, approval_stage: "first_ok", first_approved_by: "me" } : row,
          ),
        );
      } else {
        setRows((prev) => prev.filter((row) => row.id !== id));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function freezeUser(userId: string, rowId: string) {
    setBusyId(rowId);
    setError(null);
    try {
      await ownerSetWalletFrozen({
        data: { userId, frozen: true, reason: "Frozen from withdrawals queue" },
      });
      setRows((prev) =>
        prev.map((r) => (r.id === rowId ? { ...r, wallet_frozen: true } : r)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Freeze failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-6 text-white">
      <h1 className="text-xl font-bold">Withdrawals</h1>
      <p className="mt-1 text-xs text-white/45">
        Mark paid only after on-chain send. Dual-approval needs two different owners. Risk scores
        auto-enrich. Every Paid mark posts public proof to your payment channel (configure under
        Payout policy).
      </p>
      {error ? <p className="mt-3 text-xs text-amber-300">{error}</p> : null}
      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-white/8 bg-[#12141c] p-4 text-sm text-white/40">
            No pending withdrawals.
          </p>
        ) : (
          rows.map((w) => {
            const dual = Boolean(w.requires_dual);
            const stage = String(w.approval_stage ?? "pending");
            const firstOk = stage === "first_ok" || stage === "ready";
            const score = w.risk_score ?? null;
            const highRisk = score != null && score >= 40;

            return (
              <div
                key={w.id}
                className={`space-y-2 rounded-2xl border p-4 ${
                  highRisk ? "border-amber-400/30 bg-[#1a1208]" : "border-white/8 bg-[#12141c]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">
                    ${Number(w.amount).toFixed(2)} · {w.method}
                  </p>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {dual ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          firstOk
                            ? "bg-emerald-500/15 text-emerald-300"
                            : "bg-amber-500/15 text-amber-200"
                        }`}
                      >
                        {firstOk ? "1/2 approved" : "DUAL required"}
                      </span>
                    ) : null}
                    {score != null ? (
                      <span className={`text-[10px] font-bold tabular-nums ${riskColor(score)}`}>
                        Risk {score}
                      </span>
                    ) : null}
                  </div>
                </div>
                <p className="text-xs text-white/50">
                  {(w as { display_name?: string }).display_name || "User"}
                  {(w as { username?: string }).username
                    ? ` · @${(w as { username?: string }).username}`
                    : ""}
                  {w.wallet_frozen ? " · 🔒 frozen" : ""}
                </p>
                <p className="text-[10px] text-white/40">
                  {w.presence_label ?? "—"} · {w.country_line ?? "—"}
                </p>
                {(w.risk_signals ?? []).length > 0 ? (
                  <ul className="space-y-0.5 text-[10px] text-amber-200/80">
                    {(w.risk_signals ?? []).slice(0, 3).map((s) => (
                      <li key={s}>• {s}</li>
                    ))}
                  </ul>
                ) : null}
                <p className="break-all text-[11px] text-white/35">{w.address}</p>
                <input
                  value={txHashes[w.id] ?? ""}
                  onChange={(e) => setTxHashes((prev) => ({ ...prev, [w.id]: e.target.value }))}
                  placeholder={
                    Number(w.amount) >= 20
                      ? "On-chain tx hash (required ≥ $20)"
                      : "On-chain tx hash (optional)"
                  }
                  className={`w-full rounded-xl border bg-[#0a0c12] px-3 py-2 text-[11px] text-white/80 outline-none focus:border-cyan-400/40 ${
                    Number(w.amount) >= 20 && !(txHashes[w.id] ?? "").trim()
                      ? "border-amber-400/40"
                      : "border-white/10"
                  }`}
                />
                <div className="flex flex-wrap gap-2">
                  {dual && !firstOk ? (
                    <button
                      type="button"
                      disabled={busyId === w.id}
                      onClick={() => void act(w.id, "first_approve")}
                      className="flex-1 rounded-xl border border-amber-400/30 bg-amber-500/10 py-2 text-xs font-bold text-amber-200 disabled:opacity-50"
                    >
                      First approve
                    </button>
                  ) : null}
                  <button
                    type="button"
                    disabled={busyId === w.id || (dual && !firstOk)}
                    onClick={() => void act(w.id, "paid")}
                    className="flex-1 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 py-2 text-xs font-bold text-white disabled:opacity-40"
                  >
                    {dual ? "2nd · Mark paid" : "Mark paid"}
                  </button>
                  <button
                    type="button"
                    disabled={busyId === w.id}
                    onClick={() => void act(w.id, "rejected")}
                    className="rounded-xl border border-white/10 px-3 py-2 text-xs font-bold text-white/50 disabled:opacity-50"
                  >
                    Reject
                  </button>
                  {!w.wallet_frozen && w.user_id ? (
                    <button
                      type="button"
                      disabled={busyId === w.id}
                      onClick={() => void freezeUser(String(w.user_id), w.id)}
                      className="rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200 disabled:opacity-50"
                    >
                      Freeze
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
