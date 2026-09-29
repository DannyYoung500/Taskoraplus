import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Search, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { ownerListLedger } from "@/lib/owner-more.functions";

export const Route = createFileRoute("/_authenticated/owner/ledger")({ component: OwnerLedgerPage });
type LedgerRow = Record<string, unknown>;

function OwnerLedgerPage() {
  const [source, setSource] = useState("");
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void ownerListLedger({ data: { limit: 200 } })
      .then((r) => { setSource(r.source); setRows(r.rows as LedgerRow[]); })
      .catch((e) => setMsg(e instanceof Error ? e.message : "Load failed"));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.entry_type, r.reference, r.user_id, r.correlation_id].map((v) => String(v ?? "")).join(" ").toLowerCase().includes(q),
    );
  }, [rows, search]);

  const totals = useMemo(() => filtered.reduce(
    (a, r) => ({ credit: a.credit + Number(r.credit ?? 0), debit: a.debit + Number(r.debit ?? 0) }),
    { credit: 0, debit: 0 },
  ), [filtered]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <div className="mb-4 flex items-center gap-2">
        <Link to="/owner" className="rounded-full border border-white/10 p-2 text-white/60"><ChevronLeft className="size-4" /></Link>
        <div>
          <h1 className="text-xl font-bold">Ledger & Reconciliation</h1>
          <p className="text-xs text-white/45">{\${source === "ledger" ? "Real append-only ledger" : "Transaction fallback"} · {filtered.length} entries}</p>
        </div>
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/5 p-3">
          <p className="text-[9px] uppercase tracking-wider text-white/35">Credits</p>
          <p className="mt-1 text-sm font-bold text-emerald-300">{\${totals.credit.toFixed(2)}}</p>
        </div>
        <div className="rounded-2xl border border-red-400/15 bg-red-500/5 p-3">
          <p className="text-[9px] uppercase tracking-wider text-white/35">Debits</p>
          <p className="mt-1 text-sm font-bold text-red-300">{\${totals.debit.toFixed(2)}}</p>
        </div>
      </div>
      <div className="mb-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-[#12141c] px-3 py-2.5">
        <Search className="size-4 text-white/30" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search user, reference, entry type…" className="w-full bg-transparent text-sm outline-none placeholder:text-white/30" />
      </div>
      {msg ? <p className="mb-2 text-xs text-red-200">{msg}</p> : null}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <p className="rounded-2xl border border-white/8 bg-[#12141c] p-4 text-sm text-white/40">No ledger rows match this view.</p>
        ) : filtered.map((r) => {
          const credit = Number(r.credit ?? 0); const debit = Number(r.debit ?? 0); const isCredit = credit > 0;
          return <div key={String(r.id)} className="rounded-2xl border border-white/8 bg-[#12141c] p-3 text-xs">
            <div className="flex items-start gap-2">
              <span className={\`mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full \${isCredit ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"}\`}>
                {isCredit ? <ArrowDownLeft className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">{\${String(r.entry_type ?? "transaction")}}</p>
                <p className="mt-1 truncate text-white/55">{\${String(r.reference ?? "")}}</p>
                <p className="mt-1 text-white/25">{\${String(r.user_id ?? "").slice(0, 8)}} · {\${new Date(String(r.created_at)).toLocaleString()}}</p>
              </div>
              <p className={\`shrink-0 font-bold tabular-nums \${isCredit ? "text-emerald-300" : "text-red-300"}\`}>
                {\${isCredit ? "+" : "−"}}{\${(isCredit ? credit : debit).toFixed(4)}}
              </p>
            </div>
          </div>;
        })}
      </div>
    </main>
  );
}
