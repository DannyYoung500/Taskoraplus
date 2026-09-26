import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { ownerUpdateDeposit } from "@/lib/owner.functions";
import { ownerListDeposits } from "@/lib/owner-more.functions";

export const Route = createFileRoute("/_authenticated/owner/deposits")({
  component: OwnerDepositsPage,
});

function OwnerDepositsPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void ownerListDeposits()
      .then((r) => {
        setRows(r.deposits as never);
        if (r.error) setMsg(r.error);
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
          <h1 className="text-xl font-bold">Deposits</h1>
          <p className="text-xs text-white/45">Initiated → pending → confirmed · min $5 advertiser</p>
        </div>
      </div>
      {msg ? <p className="mb-2 text-xs text-white/50">{msg}</p> : null}
      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-white/8 bg-[#12141c] p-4 text-sm text-white/45">
            No deposits recorded. 
          </p>
        ) : (
          rows.map((d) => (
            <div key={String(d.id)} className="rounded-2xl border border-white/8 bg-[#12141c] p-3">
              <p className="text-sm font-semibold text-amber-300">${Number(d.amount).toFixed(2)}</p>
              <p className="text-[11px] text-white/45">
                {String(d.status)} · {String(d.created_at)}
              </p>
              {d.status !== "completed" ? <div className="mt-2 flex gap-1.5">{(["processing","completed","failed","cancelled"] as const).map((s) => <button key={s} type="button" className="rounded-lg border border-white/10 px-2 py-1 text-[10px] capitalize" onClick={() => void ownerUpdateDeposit({ data: { depositId: String(d.id), status: s } }).then(() => ownerListDeposits()).then((r) => setRows(r.deposits as never)).catch((e) => setMsg(e instanceof Error ? e.message : "Update failed"))}>{s}</button>)}</div> : null}
            </div>
          ))
        )}
      </div>
    </main>
  );
}
