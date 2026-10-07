import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { listOpenAmendments, resubmitAmendment } from "@/lib/strong-tier-b.functions";
import { AppLink } from "@/components/AppLink";
import { AlertCircle, ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/amendments")({
  loader: async () => {
    try {
      const data = await listOpenAmendments();
      return { open: (data?.open ?? []) as Array<{
        id: string;
        submission_id: string;
        reason: string;
        deadline: string | null;
        task_id?: string | null;
        created_at?: string;
      }>, error: null as string | null };
    } catch (e) {
      return {
        open: [] as Array<{ id: string; submission_id: string; reason: string; deadline: string | null }>,
        error: e instanceof Error ? e.message : "Could not load amendments",
      };
    }
  },
  component: AmendmentsPage,
});

function AmendmentsPage() {
  const initial = Route.useLoaderData();
  const [rows, setRows] = useState(initial.open);
  const [error, setError] = useState(initial.error);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [proofText, setProofText] = useState<Record<string, string>>({});
  const [proofUrl, setProofUrl] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<string | null>(null);

  async function submit(submissionId: string) {
    setBusyId(submissionId);
    setError(null);
    setMsg(null);
    try {
      await resubmitAmendment({
        data: {
          submissionId,
          proofText: proofText[submissionId]?.trim() || undefined,
          proofUrl: proofUrl[submissionId]?.trim() || undefined,
        },
      });
      setRows((prev) => prev.filter((r) => r.submission_id !== submissionId));
      setMsg("Updated proof sent for review.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Re-submit failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-[#030814] px-3 pb-28 pt-3 text-white">
      <header className="mb-4 flex items-center gap-2">
        <AppLink
          to="/home"
          className="rounded-full border border-white/8 bg-white/[0.035] p-2 text-slate-300"
        >
          <ChevronLeft className="size-4" />
        </AppLink>
        <div>
          <h1 className="text-lg font-bold">Proof fixes</h1>
          <p className="text-[10px] text-slate-500">One free amendment per submission before hard reject.</p>
        </div>
      </header>

      {error ? (
        <p className="mb-3 rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      ) : null}
      {msg ? (
        <p className="mb-3 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          {msg}
        </p>
      ) : null}

      <div className="space-y-3">
        {rows.length === 0 ? (
          <div className="rounded-2xl border border-white/8 bg-[#0b1628] p-5 text-center">
            <AlertCircle className="mx-auto size-8 text-slate-500" />
            <p className="mt-2 text-sm text-slate-400">No open amendments. You're all clear.</p>
            <AppLink to="/tasks" className="mt-3 inline-block text-[11px] font-bold text-cyan-300">
              Browse tasks →
            </AppLink>
          </div>
        ) : (
          rows.map((row) => {
            const deadline = row.deadline ? new Date(row.deadline) : null;
            const hoursLeft =
              deadline && !Number.isNaN(deadline.getTime())
                ? Math.max(0, Math.round((deadline.getTime() - Date.now()) / 3600000))
                : null;
            return (
              <div
                key={row.id}
                className="rounded-2xl border border-amber-400/20 bg-[#0b1628] p-3.5 space-y-2.5"
              >
                <div className="flex items-start gap-2">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-300" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-bold text-amber-100">Fix requested</p>
                    <p className="mt-0.5 text-[11px] text-slate-300">{row.reason}</p>
                    {hoursLeft != null ? (
                      <p className="mt-1 text-[10px] text-slate-500">
                        ~{hoursLeft}h left to re-submit
                      </p>
                    ) : null}
                  </div>
                </div>
                <textarea
                  value={proofText[row.submission_id] ?? ""}
                  onChange={(e) =>
                    setProofText((p) => ({ ...p, [row.submission_id]: e.target.value }))
                  }
                  placeholder="Updated proof text / description"
                  rows={3}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white placeholder:text-slate-600 outline-none focus:border-cyan-400/40"
                />
                <input
                  value={proofUrl[row.submission_id] ?? ""}
                  onChange={(e) =>
                    setProofUrl((p) => ({ ...p, [row.submission_id]: e.target.value }))
                  }
                  placeholder="Proof URL (optional)"
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-[12px] text-white placeholder:text-slate-600 outline-none focus:border-cyan-400/40"
                />
                <button
                  type="button"
                  disabled={busyId === row.submission_id}
                  onClick={() => void submit(row.submission_id)}
                  className="w-full rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 py-2.5 text-[12px] font-bold text-white disabled:opacity-50"
                >
                  {busyId === row.submission_id ? "Sending…" : "Re-submit for review"}
                </button>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
