import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { listPendingWithdrawals, reviewWithdrawal } from "@/lib/taskora-extra.functions";

export const Route = createFileRoute("/_authenticated/owner/withdrawals")({
  loader: async () => {
    try {
      const rows = await listPendingWithdrawals();
      return { rows, error: null as string | null };
    } catch (e) {
      return {
        rows: [] as Awaited<ReturnType<typeof listPendingWithdrawals>>,
        error: e instanceof Error ? e.message : "Owner access required",
      };
    }
  },
  component: OwnerWithdrawals,
});

function OwnerWithdrawals() {
  const initial = Route.useLoaderData();
  const [rows, setRows] = useState(initial.rows);
  const [error, setError] = useState(initial.error);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function act(id: string, decision: "paid" | "rejected") {
    setBusyId(id);
    setError(null);
    try {
      await reviewWithdrawal({ data: { withdrawalId: id, decision } });
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-28 pt-6">
      <h1 className="text-xl font-bold">Withdrawals</h1>
      <p className="mt-1 text-xs text-muted-foreground">Owner review. Mark paid only after on-chain send.</p>
      {error ? <p className="mt-3 text-xs text-warning">{error}</p> : null}
      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <p className="card-surface p-4 text-sm text-muted-foreground">No pending withdrawals.</p>
        ) : (
          rows.map((w) => (
            <div key={w.id} className="card-surface space-y-2 p-4">
              <p className="text-sm font-semibold">
                ${Number(w.amount).toFixed(2)} · {w.method}
              </p>
              <p className="break-all text-xs text-muted-foreground">{w.address}</p>
              <div className="flex gap-2">
                <button
                  disabled={busyId === w.id}
                  onClick={() => act(w.id, "paid")}
                  className="bg-green-grad flex-1 rounded-xl py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
                >
                  Mark paid
                </button>
                <button
                  disabled={busyId === w.id}
                  onClick={() => act(w.id, "rejected")}
                  className="flex-1 rounded-xl border border-input py-2 text-xs font-semibold disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
