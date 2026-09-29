import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
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
  const [search, setSearch] = useState("");

  useEffect(() => {
    void ownerListLedger({ data: { limit: 200 } })
      .then((r) => {
        setSource(r.source);
        setRows(r.rows as never);
      })
      .catch((e) => setMsg(e instanceof Error ? e.message : "Load failed"));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.entry_type, r.reference, r.user_id, r.correlation_id]
        .map((v) => String(v ?? "")).join(" ").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const totals = useMemo(() => filtered.reduce(
    (a, r) => ({ credit: a.credit + Number(r.credit ?? 0), debit: a.debit + Number(r.debit ?? 0) }),
    { credit: 0, debit: 0 },
  ), [filtered]);

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
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-3">
          <p className="text-[9px] uppercase tracking-wider text-white/35">Credits</p>
          <p className="mt-1 text-sm font-bold text-emerald-300">{totals.credit.toFixed(2)}</p>
        </div>
        <div className="rounded-2xl border border-red-400/15 bg-red-500/5 p-3">
          <p className="text-[9px] uppercase tracking-wider text-white/35">Debits</p>
          <p className="mt-1 text-sm font-bold text-red-300">{totals.debit.toFixed(2)}</p>
        </div>
      </div>
      <div className="mb-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#12141c] px-3 py-2.5">
        <Search className="size-4 text-white/30" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search user, reference, entry type…" className="w-full bg-transparent text-sm outline-none placeholder:text-white/30" />
      </div>
      {msg ? <p className="text-xs text-white/50">{msg}</p> : null}
      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-white/40">No ledger rows yet.</p>
        ) : (
          filtered.map((r) => (
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
