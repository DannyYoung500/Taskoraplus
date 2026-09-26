import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ShieldAlert, RefreshCw, CheckCircle2 } from "lucide-react";
import {
  listFraudFlags,
  resolveFraudFlag,
  scanFraudSignals,
  type FraudFlagRow,
} from "@/lib/owner-ops.functions";

export const Route = createFileRoute("/_authenticated/owner/fraud")({
  component: OwnerFraud,
});

function OwnerFraud() {
  const [rows, setRows] = useState<FraudFlagRow[]>([]);
  const [filter, setFilter] = useState<"open" | "resolved" | "dismissed" | "all">("open");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setMsg(null);
    try {
      const list = await listFraudFlags({ data: { status: filter } });
      setRows(list);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Load failed");
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onScan() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await scanFraudSignals();
      setMsg(`Scan complete · ${r.created} new flag(s)`);
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Scan failed");
    } finally {
      setBusy(false);
    }
  }

  async function onResolve(id: string, status: "resolved" | "dismissed") {
    setBusy(true);
    try {
      await resolveFraudFlag({ data: { flagId: id, status } });
      await load();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <div className="mb-4 flex items-center gap-2">
        <Link to="/owner" className="rounded-full border border-white/10 p-2 text-white/60">
          <ChevronLeft className="size-4" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <ShieldAlert className="size-5 text-amber-300" /> Fraud & risk
          </h1>
          <p className="text-xs text-white/45">Live flags · shared wallets · rejects · velocity</p>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {(["open", "resolved", "dismissed", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1.5 text-[11px] font-bold capitalize ${
              filter === f
                ? "bg-amber-500/20 text-amber-200 border border-amber-400/30"
                : "border border-white/10 text-white/50"
            }`}
          >
            {f}
          </button>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => void onScan()}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-bold text-cyan-200 disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
          Scan now
        </button>
      </div>

      {msg ? <p className="mb-3 text-xs text-cyan-200/80">{msg}</p> : null}

      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-white/8 bg-[#12141c] p-4 text-center text-sm text-white/40">
            No {filter === "all" ? "" : filter} flags. Run scan to detect shared wallets & high rejects.
          </p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="rounded-2xl border border-white/8 bg-[#12141c] p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-amber-200">
                    {r.kind.replace(/_/g, " ")}
                    <span
                      className={`ml-2 text-[10px] font-bold uppercase ${
                        r.severity === "high"
                          ? "text-red-400"
                          : r.severity === "medium"
                            ? "text-amber-300"
                            : "text-slate-400"
                      }`}
                    >
                      {r.severity}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate text-xs text-white/60">
                    {r.display_name || "User"}
                    {r.username ? ` · @${r.username}` : ""}
                    {r.telegram_id ? ` · ${r.telegram_id}` : ""}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/40">
                  {r.status}
                </span>
              </div>
              {r.details ? <p className="mt-2 text-[11px] leading-relaxed text-white/50">{r.details}</p> : null}
              <p className="mt-1 text-[10px] text-white/30">{r.created_at}</p>
              {r.status === "open" ? (
                <div className="mt-2.5 flex gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onResolve(r.id, "resolved")}
                    className="inline-flex items-center gap-1 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300"
                  >
                    <CheckCircle2 className="size-3.5" /> Resolve
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void onResolve(r.id, "dismissed")}
                    className="rounded-xl border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white/50"
                  >
                    Dismiss
                  </button>
                  {r.user_id ? (
                    <Link
                      to="/owner/users"
                      className="ml-auto rounded-xl border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-cyan-300"
                    >
                      Users →
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className="mt-5 space-y-2 rounded-2xl border border-white/8 bg-[#0b1628] p-4">
        <p className="text-xs font-bold text-cyan-200">Active controls</p>
        <ul className="space-y-1.5 text-[11px] text-white/50">
          <li>· Shared payout address blocked at withdrawal</li>
          <li>· Max 12 submissions / hour · 24h new-account hold</li>
          <li>· Min withdrawal $3 · max 2 pending WDs</li>
          <li>· Invite Task Points after first verified task</li>
          <li>· Telegram join tasks: bot getChatMember auto-verify</li>
        </ul>
      </div>
    </main>
  );
}
