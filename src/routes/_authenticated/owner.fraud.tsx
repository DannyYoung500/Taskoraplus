import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ShieldAlert, RefreshCw, CheckCircle2 } from "lucide-react";
import {
  listFraudFlags,
  resolveFraudFlag,
  scanFraudSignals,
  type FraudFlagRow,
} from "@/lib/owner-ops.functions";
import { ownerUnfreezeWallet } from "@/lib/strong-next.functions";
import { ownerForceClusterScanHold } from "@/lib/strong-remaining.functions";
import { getOwnerRiskHeatmap } from "@/lib/strong-more.functions";

export const Route = createFileRoute("/_authenticated/owner/fraud")({
  component: OwnerFraud,
});

function OwnerFraud() {
  const [rows, setRows] = useState<FraudFlagRow[]>([]);
  const [filter, setFilter] = useState<"open" | "resolved" | "dismissed" | "all">("open");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [unfreezeId, setUnfreezeId] = useState("");
  const [unfreezeNote, setUnfreezeNote] = useState("reviewed — ok");
  const [heatmap, setHeatmap] = useState<{
    profilesScanned: number;
    multiDeviceClusters: number;
    topFp: { key: string; count: number; frozen: number }[];
    topIp: { key: string; count: number; frozen: number }[];
    topCc: { key: string; count: number; frozen: number }[];
  } | null>(null);

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

  async function onUnfreeze() {
    const uid = unfreezeId.trim();
    if (!uid) {
      setMsg("Enter user id to unfreeze");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await ownerUnfreezeWallet({ data: { userId: uid, note: unfreezeNote.trim() || "manual unfreeze" } });
      setMsg(`Wallet unfrozen for ${uid.slice(0, 8)}…`);
      setUnfreezeId("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Unfreeze failed");
    } finally {
      setBusy(false);
    }
  }

  async function onHeatmap() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await getOwnerRiskHeatmap();
      setHeatmap(r as typeof heatmap);
      setMsg(`Heatmap · ${r.profilesScanned} profiles · ${r.multiDeviceClusters} multi-device clusters`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Heatmap failed");
    } finally {
      setBusy(false);
    }
  }

  async function onClusterHold() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await ownerForceClusterScanHold();
      setMsg(`Cluster scan · ${r.clusters} clusters · ${r.held} held`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Cluster scan failed");
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
              filter === f ? "bg-cyan-400 text-[#05080f]" : "border border-white/10 text-white/50"
            }`}
          >
            {f}
          </button>
        ))}
        <button
          type="button"
          disabled={busy}
          onClick={() => void onScan()}
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-100 disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} />
          Scan now
        </button>
      </div>

      {msg ? <p className="mb-3 text-[12px] text-cyan-200">{msg}</p> : null}

      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-white/8 bg-[#12151c] p-4 text-[12px] text-white/40">
            No flags in this filter.
          </p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="rounded-2xl border border-white/8 bg-[#12151c] p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white">{r.kind || "Flag"}</p>
                  <p className="truncate text-[11px] text-white/45">
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

      <div className="mt-5 space-y-3 rounded-2xl border border-amber-400/20 bg-amber-500/5 p-4">
        <p className="text-xs font-bold text-amber-200">Wallet unfreeze (cluster recovery)</p>
        <input
          value={unfreezeId}
          onChange={(e) => setUnfreezeId(e.target.value)}
          placeholder="User UUID"
          className="w-full rounded-xl border border-white/10 bg-[#0a0c12] px-3 py-2 text-[13px] outline-none"
        />
        <input
          value={unfreezeNote}
          onChange={(e) => setUnfreezeNote(e.target.value)}
          placeholder="Note"
          className="w-full rounded-xl border border-white/10 bg-[#0a0c12] px-3 py-2 text-[13px] outline-none"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onUnfreeze()}
            className="flex-1 rounded-xl bg-emerald-400 py-2.5 text-xs font-extrabold text-[#05080f] disabled:opacity-50"
          >
            Unfreeze wallet
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onClusterHold()}
            className="flex-1 rounded-xl border border-amber-400/30 bg-amber-500/10 py-2.5 text-xs font-bold text-amber-100 disabled:opacity-50"
          >
            Cluster scan hold
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-3 rounded-2xl border border-cyan-400/20 bg-cyan-500/5 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-bold text-cyan-200">Risk heatmap (FP · IP · country)</p>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onHeatmap()}
            className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-bold text-cyan-100 disabled:opacity-50"
          >
            Load heatmap
          </button>
        </div>
        {heatmap ? (
          <div className="space-y-3 text-[11px] text-white/60">
            <p>
              Scanned {heatmap.profilesScanned} · multi-device clusters {heatmap.multiDeviceClusters}
            </p>
            {heatmap.topFp.slice(0, 5).map((r) => (
              <p key={r.key}>
                FP <code className="text-cyan-200">{r.key}</code> · {r.count} accounts
                {r.frozen ? ` · ${r.frozen} frozen` : ""}
              </p>
            ))}
            {heatmap.topIp.slice(0, 3).map((r) => (
              <p key={r.key}>
                IP <code className="text-amber-200">{r.key}</code> · {r.count}
              </p>
            ))}
            {heatmap.topCc.slice(0, 5).map((r) => (
              <p key={r.key}>
                {r.key}: {r.count} users{r.frozen ? ` · ${r.frozen} frozen` : ""}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-white/40">Load to see shared devices, IPs, and countries.</p>
        )}
      </div>

      <div className="mt-5 space-y-2 rounded-2xl border border-white/8 bg-[#0b1628] p-4">
        <p className="text-xs font-bold text-cyan-200">Active controls</p>
        <ul className="space-y-1.5 text-[11px] text-white/50">
          <li>· Shared payout address blocked at withdrawal</li>
          <li>· Hard initData + device-change cool-down on WD</li>
          <li>· Soft ban after 3 rejected proofs / 24h</li>
          <li>· Dual approval if payout address &lt; 48h old</li>
          <li>· Soft KYC + connected account before first WD</li>
        </ul>
      </div>
    </main>
  );
}
