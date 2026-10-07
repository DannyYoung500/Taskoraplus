import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { listPendingSubmissions, reviewSubmission } from "@/lib/taskora.functions";
import { requestAmendment } from "@/lib/strong-tier-b.functions";

export const Route = createFileRoute("/_authenticated/owner/reviews")({
  loader: async () => {
    try {
      const rows = await listPendingSubmissions();
      return { rows, error: null as string | null };
    } catch (e) {
      return {
        rows: [] as Awaited<ReturnType<typeof listPendingSubmissions>>,
        error: e instanceof Error ? e.message : "Unable to load reviews",
      };
    }
  },
  component: OwnerReviewsPage,
});

function OwnerReviewsPage() {
  const initial = Route.useLoaderData();
  const [rows, setRows] = useState(initial.rows);
  const [error, setError] = useState(initial.error);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [amendReason, setAmendReason] = useState<Record<string, string>>({});
  const [showAmend, setShowAmend] = useState<string | null>(null);

  async function act(id: string, decision: "verified" | "rejected") {
    setBusyId(id);
    setError(null);
    try {
      await reviewSubmission({ data: { submissionId: id, decision } });
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setBusyId(null);
    }
  }

  async function requestFix(id: string) {
    const reason = (amendReason[id] ?? "").trim();
    if (reason.length < 4) {
      setError("Explain what needs fixing (min 4 characters).");
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      await requestAmendment({ data: { submissionId: id, reason } });
      setRows((prev) => prev.filter((r) => r.id !== id));
      setShowAmend(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Amendment request failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-28 pt-6">
      <h1 className="text-xl font-bold">Task review</h1>
      <p className="mt-1 text-xs text-muted-foreground">
        Owner/admin only. Approve, reject, or request one free amendment before hard reject.
      </p>

      {error ? <p className="mt-3 text-xs text-warning">{error}</p> : null}

      <div className="mt-4 space-y-3">
        {rows.length === 0 ? (
          <p className="card-surface p-4 text-sm text-muted-foreground">No pending submissions.</p>
        ) : (
          rows.map((row) => {
            const task = row.tasks as {
              title?: string;
              advertiser?: string;
              reward?: number;
              platform?: string;
            } | null;
            return (
              <div key={row.id} className="card-surface space-y-2 p-4">
                <p className="text-sm font-semibold">{task?.title ?? "Task"}</p>
                <p className="text-xs text-muted-foreground">
                  {task?.advertiser} · {task?.platform} · ${Number(task?.reward ?? 0).toFixed(2)}
                </p>
                {row.proof_text ? (
                  <p className="text-xs">Proof: {row.proof_text}</p>
                ) : null}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    disabled={busyId === row.id}
                    onClick={() => act(row.id, "verified")}
                    className="bg-green-grad flex-1 min-w-[80px] rounded-xl py-2 text-xs font-bold text-primary-foreground disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    disabled={busyId === row.id}
                    onClick={() => setShowAmend(showAmend === row.id ? null : row.id)}
                    className="flex-1 min-w-[80px] rounded-xl border border-amber-400/40 py-2 text-xs font-semibold text-amber-200 disabled:opacity-50"
                  >
                    Amend
                  </button>
                  <button
                    disabled={busyId === row.id}
                    onClick={() => act(row.id, "rejected")}
                    className="flex-1 min-w-[80px] rounded-xl border border-input py-2 text-xs font-semibold disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
                {showAmend === row.id ? (
                  <div className="space-y-2 pt-1">
                    <textarea
                      value={amendReason[row.id] ?? ""}
                      onChange={(e) =>
                        setAmendReason((p) => ({ ...p, [row.id]: e.target.value }))
                      }
                      placeholder="What should the worker fix? (e.g. screenshot must show handle + date)"
                      rows={2}
                      className="w-full rounded-xl border border-input bg-background px-3 py-2 text-xs outline-none"
                    />
                    <button
                      disabled={busyId === row.id}
                      onClick={() => void requestFix(row.id)}
                      className="w-full rounded-xl bg-amber-500/20 border border-amber-400/40 py-2 text-xs font-bold text-amber-100 disabled:opacity-50"
                    >
                      {busyId === row.id ? "Sending…" : "Send amendment request"}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
