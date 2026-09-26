import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { ownerListLedger } from "@/lib/owner-more.functions";

export const Route = createFileRoute("/_authenticated/owner/ledger")({
  component: OwnerLedgerPage,
});

function OwnerLedgerPage() {
  const [source, setSource] = useState("");
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void ownerListLedger({ data: {} })
      .then((r) => {
        setSource(r.source);
        setRows(r.rows as never);
      })
      .catch((e) => setMsg(e instanceof Error ? e.message : "Load failed"));
  }, []);

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <div className="mb-4 flex items-center gap-2">
        <Link to="/owner" className="rounded-full border border-white/10 p-2 text-white/60">
          <ChevronLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Ledger & Reconciliation</h1>
          <p className="text-xs text-white/45">Append-only view · source: {source || "…"}</p>
        </div>
      </div>
      {msg ? <p className="text-xs text-white/50">{msg}</p> : null}
      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-white/40">No ledger rows yet.</p>
        ) : (
          rows.map((r) => (
            <div key={String(r.id)} className="rounded-2xl border border-white/8 bg-[#12141c] p-3 text-xs">
              <p className="font-semibold text-amber-200">{String(r.entry_type ?? r.kind)}</p>
              <p className="mt-1 text-white/60">
                +{Number(r.credit ?? 0).toFixed(4)} / −{Number(r.debit ?? 0).toFixed(4)}
              </p>
              <p className="mt-1 text-white/35">{String(r.reference ?? r.label ?? "")}</p>
              <p className="mt-1 text-white/25">{String(r.created_at)}</p>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
