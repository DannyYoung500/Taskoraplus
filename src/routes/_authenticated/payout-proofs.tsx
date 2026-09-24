import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, ChevronLeft, ExternalLink, Shield } from "lucide-react";
import { listPublicPayoutProofs } from "@/lib/payout-proofs.functions";

export const Route = createFileRoute("/_authenticated/payout-proofs")({
  loader: async () => {
    try {
      const data = await listPublicPayoutProofs();
      return { ...data, error: null as string | null };
    } catch (e) {
      return {
        rows: [] as Awaited<ReturnType<typeof listPublicPayoutProofs>>["rows"],
        total: 0,
        error: e instanceof Error ? e.message : "Could not load proofs",
      };
    }
  },
  head: () => ({ meta: [{ title: "Payout proofs — TASKORA" }] }),
  component: PayoutProofsPage,
});

function explorerUrl(tx: string, method: string): string | null {
  const t = tx.trim();
  if (/^0x[a-fA-F0-9]{40,}$/.test(t)) return `https://etherscan.io/tx/${t}`;
  if (/^[a-fA-F0-9]{64}$/.test(t)) {
    if (/BEP|BSC/i.test(method)) return `https://bscscan.com/tx/${t}`;
    return `https://tronscan.org/#/transaction/${t}`;
  }
  return null;
}

function PayoutProofsPage() {
  const { rows, total, error } = Route.useLoaderData();

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <div className="flex items-center gap-2">
        <Link
          to="/wallet"
          className="inline-flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/5"
        >
          <ChevronLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Payout proofs</h1>
          <p className="text-[11px] text-white/45">
            Recent paid withdrawals · addresses redacted · public trust log
          </p>
        </div>
      </div>

      <div
        className="mt-4 flex items-start gap-2 rounded-2xl border border-cyan-400/20 p-3"
        style={{ background: "linear-gradient(135deg, rgba(6,182,212,0.12), rgba(37,99,235,0.08))" }}
      >
        <Shield className="mt-0.5 size-4 shrink-0 text-cyan-300" />
        <p className="text-[11px] leading-relaxed text-white/70">
          Every paid withdrawal is logged here and posted to the TASKORA payment channel. Tx hashes
          are required for payouts ≥ $20.
        </p>
      </div>

      {error ? <p className="mt-3 text-xs text-amber-200">{error}</p> : null}

      <p className="mt-4 text-[11px] text-white/40">
        Showing {rows.length}
        {total > rows.length ? ` of ${total}` : ""} paid
      </p>

      <div className="mt-2 space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-white/8 bg-[#12141c] p-4 text-sm text-white/40">
            No paid withdrawals yet.
          </p>
        ) : (
          rows.map((r) => {
            const exp = r.tx_hash ? explorerUrl(r.tx_hash, r.method) : null;
            const when = r.processed_at || r.created_at;
            return (
              <div
                key={r.id}
                className="rounded-2xl border border-white/8 bg-[#12141c] p-3.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold tabular-nums text-emerald-300">
                      ${Number(r.amount).toFixed(2)}{" "}
                      <span className="text-[11px] font-medium text-white/45">{r.method}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-white/50">
                      {r.display_name || "Tasker"} · <code className="text-white/70">{r.address_short}</code>
                    </p>
                  </div>
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-400/80" />
                </div>
                {r.tx_hash ? (
                  <p className="mt-2 break-all text-[10px] text-white/40">
                    Tx <code className="text-cyan-200/90">{r.tx_hash.slice(0, 42)}
                    {r.tx_hash.length > 42 ? "…" : ""}</code>
                  </p>
                ) : (
                  <p className="mt-2 text-[10px] text-white/30">No tx hash on record</p>
                )}
                <div className="mt-2 flex items-center justify-between gap-2">
                  <p className="text-[10px] text-white/30">
                    {when ? new Date(when).toLocaleString() : "—"}
                  </p>
                  {exp ? (
                    <a
                      href={exp}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-cyan-300"
                    >
                      Explorer <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      <p className="mt-6 text-center text-[10px] text-white/25">
        TASKORA · verified payouts only
      </p>
    </main>
  );
}
