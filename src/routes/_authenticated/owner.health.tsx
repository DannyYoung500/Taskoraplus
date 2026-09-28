import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { getSystemHealth } from "@/lib/owner-ops.functions";
import {
  getOwnerKillSwitches,
  setOwnerKillSwitch,
  getWebhookHealthBadge,
  ownerAlertStuckWithdrawals,
  ownerAlertStuckCampaigns,
} from "@/lib/strong-wave.functions";

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
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void getSystemHealth()
      .then(setData)
      .catch((e) => setMsg(e instanceof Error ? e.message : "Load failed"));
    void getOwnerKillSwitches()
      .then(setSwitches)
      .catch(() => undefined);
    void getWebhookHealthBadge()
      .then((w) => setWebhook({ status: w.status, detail: w.detail }))
      .catch(() => undefined);
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
      setMsg(`${key} → ${next ? "ON" : "OFF"}`);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Update failed");
    } finally {
      setBusy(null);
    }
  }

  async function runCron(kind: "wd" | "campaigns") {
    setBusy(kind);
    setMsg(null);
    try {
      if (kind === "wd") {
        const r = await ownerAlertStuckWithdrawals();
        setMsg(`Stuck withdrawals: ${r.count} · ~$${Number(r.totalUsd).toFixed(2)}`);
      } else {
        const r = await ownerAlertStuckCampaigns();
        setMsg(`Stuck campaigns: ${r.count}`);
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Cron failed");
    } finally {
      setBusy(null);
    }
  }

  const switchRows: Array<{ key: keyof Switches; label: string }> = [
    { key: "read_only", label: "Read-only mode" },
    { key: "withdrawals_paused", label: "Pause withdrawals" },
    { key: "deposits_paused", label: "Pause deposits" },
    { key: "task_creation_paused", label: "Pause task submits" },
    { key: "verification_paused", label: "Pause verification" },
    { key: "watches_paused", label: "Pause Watch & Earn" },
  ];

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1440px] bg-[#05070c] px-4 pb-16 pt-6 sm:px-6 lg:px-8 text-white">
      <div className="mb-4 flex items-center gap-2">
        <Link to="/owner" className="rounded-full border border-white/10 p-2 text-white/60">
          <ChevronLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">System Health</h1>
          <p className="text-xs text-white/45">Probes · kill switches · cron</p>
        </div>
      </div>
      {msg ? <p className="mb-3 text-xs text-cyan-300">{msg}</p> : null}

      {webhook ? (
        <div className="mb-3 rounded-2xl border border-white/8 bg-[#0b1422] px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Telegram webhook</p>
            <span
              className={
                webhook.status === "ok"
                  ? "text-emerald-400"
                  : webhook.status === "warn"
                    ? "text-amber-300"
                    : "text-red-400"
              }
            >
              {webhook.status}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-white/45">{webhook.detail}</p>
        </div>
      ) : null}

      {switches ? (
        <section className="mb-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300/80">Kill switches</p>
          {switchRows.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              disabled={busy === key}
              onClick={() => void toggle(key)}
              className="flex w-full items-center justify-between rounded-2xl border border-white/8 bg-[#12141c] px-4 py-3 text-left disabled:opacity-50"
            >
              <span className="text-sm font-semibold">{label}</span>
              <span
                className={
                  switches[key]
                    ? "rounded-full bg-red-500/15 px-2.5 py-0.5 text-[10px] font-black text-red-300"
                    : "rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-black text-emerald-300"
                }
              >
                {switches[key] ? "ON" : "OFF"}
              </span>
            </button>
          ))}
        </section>
      ) : null}

      <section className="mb-4 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300/80">Manual cron</p>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy === "wd"}
            onClick={() => void runCron("wd")}
            className="flex-1 rounded-xl border border-cyan-400/25 bg-cyan-400/10 py-2.5 text-xs font-bold text-cyan-200 disabled:opacity-50"
          >
            Alert stuck WDs
          </button>
          <button
            type="button"
            disabled={busy === "campaigns"}
            onClick={() => void runCron("campaigns")}
            className="flex-1 rounded-xl border border-cyan-400/25 bg-cyan-400/10 py-2.5 text-xs font-bold text-cyan-200 disabled:opacity-50"
          >
            Alert stuck campaigns
          </button>
        </div>
      </section>

      {data ? (
        <>
          <p className="mb-3 text-sm">
            Overall:{" "}
            <span
              className={
                data.overall === "ok"
                  ? "text-emerald-400"
                  : data.overall === "warn"
                    ? "text-amber-300"
                    : "text-red-400"
              }
            >
              {data.overall.toUpperCase()}
            </span>
          </p>
          <div className="space-y-2">
            {data.checks.map((c) => (
              <div
                key={c.name}
                className="rounded-2xl border border-white/8 bg-[#12141c] px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{c.name}</p>
                  <span
                    className={
                      c.status === "ok"
                        ? "text-emerald-400"
                        : c.status === "warn"
                          ? "text-amber-300"
                          : "text-red-400"
                    }
                  >
                    {c.status}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-white/45">{c.detail}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-[10px] text-white/30">{data.checkedAt}</p>
        </>
      ) : (
        <p className="text-sm text-white/40">Checking…</p>
      )}
    </main>
  );
}
