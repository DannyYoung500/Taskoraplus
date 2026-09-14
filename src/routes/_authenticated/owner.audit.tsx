import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { listAuditLogs } from "@/lib/owner-ops.functions";

export const Route = createFileRoute("/_authenticated/owner/audit")({
  component: OwnerAuditPage,
});

function OwnerAuditPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void listAuditLogs({ data: { search: search || undefined } })
      .then((r) => setRows(r as never))
      .catch((e) => setMsg(e instanceof Error ? e.message : "Load failed"));
  }, [search]);

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <div className="mb-4 flex items-center gap-2">
        <Link to="/owner" className="rounded-full border border-white/10 p-2 text-white/60">
          <ChevronLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Audit Logs</h1>
          <p className="text-xs text-white/45">Actor · action · target · time</p>
        </div>
      </div>
      <input
        className="mb-3 w-full rounded-xl border border-white/10 bg-[#12141c] px-3 py-2.5 text-sm"
        placeholder="Filter…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {msg ? <p className="text-xs text-white/50">{msg}</p> : null}
      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-white/40">No audit events yet.</p>
        ) : (
          rows.map((r) => (
            <div key={String(r.id)} className="rounded-2xl border border-white/8 bg-[#12141c] p-3 text-xs">
              <p className="font-semibold text-amber-200">{String(r.action)}</p>
              <p className="mt-1 text-white/45">
                {r.target_type ? `${r.target_type} · ${r.target_id ?? ""}` : "system"}
              </p>
              <p className="mt-1 text-white/30">{String(r.created_at)}</p>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
