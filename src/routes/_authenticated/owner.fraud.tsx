import { useCallback, useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  ChevronLeft,
  ShieldAlert,
  RefreshCw,
  CheckCircle2,
  Users,
  Radar,
  Activity,
} from "lucide-react";
import { AppLink } from "@/components/AppLink";
import {
  listFraudFlags,
  resolveFraudFlag,
  scanFraudSignals,
  type FraudFlagRow,
} from "@/lib/owner-ops.functions";
import {
  ownerScanMultiAccountClusters,
  ownerGetEarnerRiskSnapshot,
} from "@/lib/strong-elite.functions";
import { ownerRunStuckTaskSla } from "@/lib/strong-plus.functions";
import { runStrongOpsCron } from "@/lib/strong-wave.functions";

export const Route = createFileRoute("/_authenticated/owner/fraud")({
  component: OwnerFraud,
});

function OwnerFraud() {
  const [rows, setRows] = useState<FraudFlagRow[]>([]);
  const [filter, setFilter] = useState<"open" | "resolved" | "dismissed" | "all">("open");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [clusterMsg, setClusterMsg] = useState<string | null>(null);
  const [riskUserId, setRiskUserId] = useState("");
  const [riskSnap, setRiskSnap] = useState<Record<string, unknown> | null>(null);

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

  async function onClusterScan() {
    setBusy(true);
    setClusterMsg(null);
    try {
      const r = await ownerScanMultiAccountClusters();
      const clusters = Number((r as { clusters?: number }).clusters ?? 0);
      const alerted = Boolean((r as { alerted?: boolean }).alerted);
      setClusterMsg(
        clusters > 0
          ? `Found ${clusters} device cluster(s)${alerted ? " · owner channel alerted" : ""}.`
          : "No multi-account clusters (≥3) detected.",
      );
    } catch (e) {
      setClusterMsg(e instanceof Error ? e.message : "Cluster scan failed");
    } finally {
      setBusy(false);
    }
  }

  async function onCron() {
    setBusy(true);
    setMsg(null);
    try {
      const [cron, sla] = await Promise.all([
        runStrongOpsCron(),
        ownerRunStuckTaskSla().catch(() => null),
      ]);
      const stuckWd = Number((cron as { stuckWithdrawals?: number }).stuckWithdrawals ?? 0);
      const stuckCamp = Number((cron as { stuckCampaigns?: number }).stuckCampaigns ?? 0);
      const slaN = Number((sla as { flagged?: number } | null)?.flagged ?? 0);
      setMsg(
        `Cron done · stuck WD ${stuckWd} · stuck campaigns ${stuckCamp} · stuck tasks ${slaN}`,
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Cron failed");
    } finally {
      setBusy(false);
    }
  }

  async function onRiskSnapshot() {
    const id = riskUserId.trim();
    if (!id) return;
    setBusy(true);
    setRiskSnap(null);
    try {
      const snap = await ownerGetEarnerRiskSnapshot({ data: { userId: id } });
      setRiskSnap(snap as Record<string, unknown>);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Risk snapshot failed");
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
        <AppLink to="/owner" className="rounded-full border border-white/10 p-2 text-white/60">
          <ChevronLeft className="size-4" />
        </AppLink>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-xl font-bold">
            <ShieldAlert className="size-5 text-amber-300" /> Fraud & risk
          </h1>
          <p className="text-xs text-white/45">Flags · clusters · trust · velocity · SLA</p>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <button type="button" disabled={busy} onClick={() => void onScan()} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-3 py-2.5 text-[11px] font-bold text-cyan-200 disabled:opacity-50">
          <RefreshCw className={`size-3.5 ${busy ? "animate-spin" : ""}`} /> Scan flags
        </button>
        <button type="button" disabled={busy} onClick={() => void onClusterScan()} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2.5 text-[11px] font-bold text-amber-200 disabled:opacity-50">
          <Users className="size-3.5" /> Cluster scan
        </button>
        <button type="button" disabled={busy} onClick={() => void onCron()} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-violet-400/30 bg-violet-500/10 px-3 py-2.5 text-[11px] font-bold text-violet-200 disabled:opacity-50">
          <Activity className="size-3.5" /> Run ops cron
        </button>
        <AppLink to="/owner/users" className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[11px] font-bold text-white/70">
          <Radar className="size-3.5" /> Users
        </AppLink>
      </div>

      {msg ? <p className="mb-2 text-xs text-cyan-200/80">{msg}</p> : null}
      {clusterMsg ? <p className="mb-2 text-xs text-amber-200/80">{clusterMsg}</p> : null}

      <div className="mb-4 rounded-2xl border border-white/8 bg-[#0b1628] p-3">
        <p className="mb-2 text-[11px] font-bold text-cyan-200">Earner risk snapshot</p>
        <div className="flex gap-2">
          <input value={riskUserId} onChange={(e) => setRiskUserId(e.target.value)} placeholder="User UUID" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none placeholder:text-white/30" />
          <button type="button" disabled={busy || !riskUserId.trim()} onClick={() => void onRiskSnapshot()} className="shrink-0 rounded-xl border border-cyan-400/30 bg-cyan-500/15 px-3 py-2 text-[11px] font-bold text-cyan-200 disabled:opacity-50">Lookup</button>
        </div>
        {riskSnap ? (
          <div className="mt-2 space-y-1 rounded-xl bg-black/25 p-2.5 text-[11px] text-white/60">
            <p>Trust: <span className="font-bold text-white">{String(riskSnap.trustScore ?? "—")}</span> · Quality: <span className="font-bold text-white">{String(riskSnap.qualityScore ?? "—")}</span> · A/R: {String(riskSnap.approved ?? 0)}/{String(riskSnap.rejected ?? 0)}</p>
            <p className="truncate">Device FP: <code className="text-cyan-300/80">{String((riskSnap.profile as { device_fp?: string } | undefined)?.device_fp ?? "—").slice(0, 16)}</code></p>
            {Array.isArray(riskSnap.qualityFlags) && (riskSnap.qualityFlags as string[]).length > 0 ? (
              <p className="text-amber-300/90">Quality flags: {(riskSnap.qualityFlags as string[]).join(", ")}</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {(["open", "resolved", "dismissed", "all"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)} className={`rounded-full px-3 py-1.5 text-[11px] font-bold capitalize ${filter === f ? "bg-amber-500/20 text-amber-200 border border-amber-400/30" : "border border-white/10 text-white/50"}`}>{f}</button>
        ))}
      </div>

      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-white/8 bg-[#12141c] p-4 text-center text-sm text-white/40">No {filter === "all" ? "" : filter} flags. Run scan or cluster scan.</p>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="rounded-2xl border border-white/8 bg-[#12141c] p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-amber-200">{r.kind.replace(/_/g, " ")}<span className={`ml-2 text-[10px] font-bold uppercase ${r.severity === "high" ? "text-red-400" : r.severity === "medium" ? "text-amber-300" : "text-slate-400"}`}>{r.severity}</span></p>
                  <p className="mt-0.5 truncate text-xs text-white/60">{r.display_name || "User"}{r.username ? ` · @${r.username}` : ""}{r.telegram_id ? ` · ${r.telegram_id}` : ""}</p>
                </div>
                <span className="shrink-0 rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/40">{r.status}</span>
              </div>
              {r.details ? <p className="mt-2 text-[11px] leading-relaxed text-white/50">{r.details}</p> : null}
              <p className="mt-1 text-[10px] text-white/30">{r.created_at}</p>
              {r.status === "open" ? (
                <div className="mt-2.5 flex gap-2">
                  <button type="button" disabled={busy} onClick={() => void onResolve(r.id, "resolved")} className="inline-flex items-center gap-1 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-300"><CheckCircle2 className="size-3.5" /> Resolve</button>
                  <button type="button" disabled={busy} onClick={() => void onResolve(r.id, "dismissed")} className="rounded-xl border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-white/50">Dismiss</button>
                  {r.user_id ? (
                    <button type="button" className="ml-auto rounded-xl border border-white/10 px-2.5 py-1.5 text-[11px] font-bold text-cyan-300" onClick={() => { setRiskUserId(r.user_id!); void (async () => { setBusy(true); try { const snap = await ownerGetEarnerRiskSnapshot({ data: { userId: r.user_id! } }); setRiskSnap(snap as Record<string, unknown>); } catch {} finally { setBusy(false); } })(); }}>Risk →</button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))
        )}
      </div>

      <div className="mt-5 space-y-2 rounded-2xl border border-white/8 bg-[#0b1628] p-4">
        <p className="text-xs font-bold text-cyan-200">Active strong controls</p>
        <ul className="space-y-1.5 text-[11px] text-white/50">
          <li>· Trust score gate (min 40) + quality gate (min 35) on withdraw</li>
          <li>· Graduated daily WD: trust 40–60 → $5 · 60–80 → $15 · 80+ full</li>
          <li>· Device FP multi-account lock · address allowlist 24h</li>
          <li>· Proof hash + perceptual dedup · behavioral velocity 12/15m</li>
          <li>· Bonus ad one-time session token · AdsGram/Monetag ready</li>
          <li>· Stuck WD / campaign / task SLA via ops cron</li>
        </ul>
      </div>
    </main>
  );
}
