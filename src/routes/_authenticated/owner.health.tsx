import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { getSystemHealth } from "@/lib/owner-ops.functions";
import { AppLink } from "@/components/AppLink";
import {
  getOwnerKillSwitches,
  setOwnerKillSwitch,
  getWebhookHealthBadge,
  ownerAlertStuckWithdrawals,
  ownerAlertStuckCampaigns,
} from "@/lib/strong-wave.functions";
import { ownerRunStuckWithdrawalSla } from "@/lib/strong-premium.functions";
import {
  ownerGetBotEnvStatus,
  ownerProbeDiscordInvite,
  ownerRunMembershipRecheckNow,
  ownerRunStrongNightlyNow,
  type BotEnvStatus,
} from "@/lib/owner-fortress-ops.functions";

export const Route = createFileRoute("/_authenticated/owner/health")({
  component: OwnerHealthPage,
});

type Switches = {
  read_only: boolean;
  withdrawals_paused: boolean;
  deposits_paused: boolean;
  task_creation_paused: boolean;
  verification_paused: boolean;
  watches_paused: boolean;
};

function OwnerHealthPage() {
  const [data, setData] = useState<{
    overall: string;
    checks: Array<{ name: string; status: string; detail: string }>;
    checkedAt: string;
  } | null>(null);
  const [switches, setSwitches] = useState<Switches | null>(null);
  const [webhook, setWebhook] = useState<{ status: string; detail: string } | null>(null);
  const [bots, setBots] = useState<BotEnvStatus | null>(null);
  const [inviteInput, setInviteInput] = useState("");
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void getSystemHealth().then(setData).catch((e) => setMsg(e instanceof Error ? e.message : "Load failed"));
    void getOwnerKillSwitches().then(setSwitches).catch(() => undefined);
    void getWebhookHealthBadge()
      .then((w) => setWebhook({ status: w.status, detail: w.detail }))
      .catch(() => undefined);
    void ownerGetBotEnvStatus().then(setBots).catch(() => undefined);
  }, []);

  async function toggle(key: keyof Switches) {
    if (!switches) return;
    setBusy(key);
    setMsg(null);
    try {
      const next = !switches[key];
      const res = await setOwnerKillSwitch({ data: { key, value: next } });
      setSwitches({
        read_only: Boolean(res.switches.read_only),
        withdrawals_paused: Boolean(res.switches.withdrawals_paused),
        deposits_paused: Boolean(res.switches.deposits_paused),
        task_creation_paused: Boolean(res.switches.task_creation_paused),
        verification_paused: Boolean(res.switches.verification_paused),
        watches_paused: Boolean(res.switches.watches_paused),
      });
      setMsg(`${key} -> ${next ? "ON" : "OFF"}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  async function runCron(kind: string) {
    setBusy(kind);
    setMsg(null);
    try {
      if (kind === "wd") {
        const r = await ownerAlertStuckWithdrawals();
        setMsg(`Stuck withdrawals: ${r.count}`);
      } else if (kind === "wd_sla") {
        const r = await ownerRunStuckWithdrawalSla({ data: { hours: 12 } });
        setMsg(`WD SLA: ${r.count} stuck · flagged ${r.flagged}`);
      } else if (kind === "campaigns") {
        const r = await ownerAlertStuckCampaigns();
        setMsg(`Stuck campaigns: ${r.count}`);
      } else if (kind === "membership") {
        const r = await ownerRunMembershipRecheckNow({
          data: { minAgeHours: 20, maxAgeHours: 72, limit: 80, platform: "all" },
        });
        setMsg(`Membership: checked ${r.checked} · left ${r.left} · clawed ${r.clawed}`);
      } else if (kind === "nightly") {
        const r = await ownerRunStrongNightlyNow();
        setMsg(`Nightly done · keys: ${Object.keys(r).join(", ")}`);
      } else if (kind === "reactivate") {
        const { ownerReactivatePausedTasks } = await import("@/lib/strong-p6.functions");
        const r = await ownerReactivatePausedTasks({ data: { onlyVelocity: false } });
        setMsg(`Reactivated ${r.reactivated} of ${r.scanned} paused tasks`);
      } else if (kind === "p9") {
        const { ownerRunP9Nightly } = await import("@/lib/strong-p9.functions");
        const r = await ownerRunP9Nightly();
        setMsg(`P9: device clusters ${r.deviceClusters} · spend-paused ${r.spendPaused}`);
      } else if (kind === "bots") {
        const s = await ownerGetBotEnvStatus();
        setBots(s);
        setMsg("Bots refreshed");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function probeInvite() {
    setBusy("invite");
    setInviteResult(null);
    try {
      const r = await ownerProbeDiscordInvite({ data: { invite: inviteInput } });
      setInviteResult(r.detail);
      setMsg(r.ok ? "Invite OK" : "Invite probe failed");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Probe failed");
    } finally {
      setBusy(null);
    }
  }

  const switchLabels: Record<keyof Switches, string> = {
    read_only: "Read-only mode",
    withdrawals_paused: "Pause withdrawals",
    deposits_paused: "Pause deposits",
    task_creation_paused: "Pause task creation",
    verification_paused: "Pause verification",
    watches_paused: "Pause watch & earn",
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#080808] px-4 pb-28 pt-3 text-neutral-100">
      <div className="mb-4 flex items-center gap-2">
        <AppLink to="/owner" className="inline-flex size-9 items-center justify-center rounded-full border border-white/10 bg-white/5">
          <ChevronLeft className="size-4" />
        </AppLink>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Owner</p>
          <h1 className="text-lg font-bold">System Health</h1>
        </div>
      </div>

      {msg ? <p className="mb-3 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-center text-[12px] text-amber-100">{msg}</p> : null}

      <section className="mb-4 space-y-2 rounded-2xl border border-white/10 bg-[#121212] p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Kill switches</p>
        {switches
          ? (Object.keys(switchLabels) as Array<keyof Switches>).map((key) => (
              <button
                key={key}
                type="button"
                disabled={busy === key}
                onClick={() => void toggle(key)}
                className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-[13px] ${
                  switches[key]
                    ? "border-red-400/30 bg-red-500/15 text-red-100"
                    : "border-white/10 bg-white/5 text-white/80"
                }`}
              >
                <span>{switchLabels[key]}</span>
                <span className="text-[11px] font-bold">{switches[key] ? "ON" : "OFF"}</span>
              </button>
            ))
          : (
              <p className="text-[12px] text-white/40">Loading switches…</p>
            )}
      </section>

      <section className="mb-4 space-y-2 rounded-2xl border border-white/10 bg-[#121212] p-4">
        <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Ops actions</p>
        <button type="button" disabled={busy === "wd"} onClick={() => void runCron("wd")} className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-xs font-bold text-white/80 disabled:opacity-50">
          {busy === "wd" ? "Running…" : "Alert stuck withdrawals"}
        </button>
        <button type="button" disabled={busy === "wd_sla"} onClick={() => void runCron("wd_sla")} className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-xs font-bold text-white/80 disabled:opacity-50">
          {busy === "wd_sla" ? "Running…" : "WD SLA (12h)"}
        </button>
        <button type="button" disabled={busy === "campaigns"} onClick={() => void runCron("campaigns")} className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-xs font-bold text-white/80 disabled:opacity-50">
          {busy === "campaigns" ? "Running…" : "Alert stuck campaigns"}
        </button>
        <button type="button" disabled={busy === "membership"} onClick={() => void runCron("membership")} className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-xs font-bold text-white/80 disabled:opacity-50">
          {busy === "membership" ? "Running…" : "Membership recheck"}
        </button>
        <button type="button" disabled={busy === "nightly"} onClick={() => void runCron("nightly")} className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-xs font-bold text-white/80 disabled:opacity-50">
          {busy === "nightly" ? "Running…" : "Strong nightly suite"}
        </button>
        <button type="button" disabled={busy === "p9"} onClick={() => void runCron("p9")} className="w-full rounded-xl border border-violet-400/30 bg-violet-400/15 py-3 text-xs font-bold text-violet-100 disabled:opacity-50">
          {busy === "p9" ? "Running P9…" : "Run P9 nightly (clusters + spend)"}
        </button>
        <button type="button" disabled={busy === "reactivate"} onClick={() => void runCron("reactivate")} className="w-full rounded-xl border border-emerald-400/30 bg-emerald-400/15 py-3 text-xs font-bold text-emerald-100 disabled:opacity-50">
          {busy === "reactivate" ? "Reactivating…" : "Reactivate paused tasks"}
        </button>
        <button type="button" disabled={busy === "bots"} onClick={() => void runCron("bots")} className="w-full rounded-xl border border-white/10 bg-white/5 py-3 text-xs font-bold text-white/80 disabled:opacity-50">
          {busy === "bots" ? "…" : "Refresh bot env status"}
        </button>
      </section>

      {webhook ? (
        <section className="mb-4 rounded-2xl border border-white/10 bg-[#121212] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Webhooks</p>
          <p className="mt-1 text-sm font-medium">{webhook.status}: {webhook.detail}</p>
        </section>
      ) : null}

      {bots ? (
        <section className="mb-4 rounded-2xl border border-white/10 bg-[#121212] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Bots</p>
          <pre className="mt-2 overflow-x-auto text-[11px] text-white/60">{JSON.stringify(bots, null, 2)}</pre>
          <div className="mt-3 flex gap-2">
            <input
              value={inviteInput}
              onChange={(e) => setInviteInput(e.target.value)}
              placeholder="Discord invite code"
              className="flex-1 rounded-xl bg-[#1a1a1a] px-3 py-2 text-[12px] outline-none"
            />
            <button type="button" disabled={busy === "invite"} onClick={() => void probeInvite()} className="rounded-xl bg-orange-500 px-3 py-2 text-[12px] font-bold text-[#0a0a0a] disabled:opacity-50">
              Probe
            </button>
          </div>
          {inviteResult ? <p className="mt-2 text-[11px] text-white/50">{inviteResult}</p> : null}
        </section>
      ) : null}

      {data ? (
        <>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">Checks</p>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              data.overall === "ok" ? "bg-emerald-500/20 text-emerald-300" : "bg-amber-500/20 text-amber-200"
            }`}>{data.overall}</span>
          </div>
          <div className="space-y-2">
            {data.checks.map((c) => (
              <div key={c.name} className="rounded-xl border border-white/10 bg-[#121212] px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-medium">{c.name}</p>
                  <span className={`text-[10px] font-bold ${
                    c.status === "ok" ? "text-emerald-400" : c.status === "warn" ? "text-amber-300" : "text-red-400"
                  }`}>{c.status}</span>
                </div>
                <p className="mt-1 text-[11px] text-white/45">{c.detail}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-[10px] text-white/30">{data.checkedAt}</p>
        </>
      ) : (
        <p className="text-sm text-white/40">Checking...</p>
      )}
    </main>
  );
}
