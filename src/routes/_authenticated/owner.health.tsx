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

  function loadBots() {
    void ownerGetBotEnvStatus()
      .then(setBots)
      .catch(() => undefined);
  }

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
    loadBots();
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

  async function runCron(kind: "wd" | "campaigns" | "wd_sla" | "membership" | "nightly" | "bots") {
    setBusy(kind);
    setMsg(null);
    try {
      if (kind === "wd") {
        const r = await ownerAlertStuckWithdrawals();
        setMsg(`Stuck withdrawals: ${r.count} · ~$${Number(r.totalUsd).toFixed(2)}`);
      } else if (kind === "wd_sla") {
        const r = await ownerRunStuckWithdrawalSla({ data: { hours: 12 } });
        setMsg(`WD SLA: ${r.count} stuck · ~$${Number(r.totalUsd).toFixed(2)} · flagged ${r.flagged}`);
      } else if (kind === "campaigns") {
        const r = await ownerAlertStuckCampaigns();
        setMsg(`Stuck campaigns: ${r.count}`);
      } else if (kind === "membership") {
        const r = await ownerRunMembershipRecheckNow({
          data: { minAgeHours: 20, maxAgeHours: 72, limit: 80, platform: "all" },
        });
        setMsg(
          `Membership recheck: checked ${r.checked} (TG ${r.telegramChecked} · DC ${r.discordChecked}) · left ${r.left} · still ${r.still} · clawed ${r.clawed} · skipped ${r.skipped}${r.discordTokenPresent ? "" : " · DISCORD_BOT_TOKEN missing"}`,
        );
      } else if (kind === "nightly") {
        const r = await ownerRunStrongNightlyNow();
        const mem = r.membership as Record<string, unknown> | undefined;
        setMsg(
          `Strong nightly done. membership left=${mem?.left ?? "?"} clawed=${mem?.clawed ?? "?"} · keys: ${Object.keys(r).join(", ")}`,
        );
      } else if (kind === "bots") {
        const s = await ownerGetBotEnvStatus();
        setBots(s);
        setMsg(
          `Bots refreshed · TG ${s.telegram.reachable ? "OK" : s.telegram.configured ? "fail" : "unset"} · DC ${s.discord.reachable ? "OK" : s.discord.configured ? "fail" : "unset"}`,
        );
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Cron failed");
    } finally {
      setBusy(null);
    }
  }

  async function probeInvite() {
    setBusy("invite");
    setInviteResult(null);
    setMsg(null);
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

  const switchRows: Array<{ key: keyof Switches; label: string }> = [
    { key: "read_only", label: "Read-only mode" },
    { key: "withdrawals_paused", label: "Pause withdrawals" },
    { key: "deposits_paused", label: "Pause deposits" },
    { key: "task_creation_paused", label: "Pause task submits" },
    { key: "verification_paused", label: "Pause verification" },
    { key: "watches_paused", label: "Pause Watch & Earn" },
  ];

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <div className="mb-4 flex items-center gap-2">
        <AppLink to="/owner" className="rounded-full border border-white/10 p-2 text-white/60">
          <ChevronLeft className="size-4" />
        </AppLink>
        <div>
          <h1 className="text-xl font-bold">System Health</h1>
          <p className="text-xs text-white/45">Bots · probes · kill switches · fortress cron</p>
        </div>
      </div>
      {msg ? <p className="mb-3 text-xs text-cyan-300">{msg}</p> : null}

      <section className="mb-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300/80">Bot tokens</p>
          <button type="button" disabled={busy === "bots"} onClick={() => void runCron("bots")} className="text-[10px] font-bold text-cyan-300/80 disabled:opacity-50">Refresh</button>
        </div>
        {bots ? (
          <>
            <div className="rounded-2xl border border-white/8 bg-[#12141c] px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Telegram bot</p>
                <span className={bots.telegram.reachable ? "text-emerald-400" : bots.telegram.configured ? "text-red-400" : "text-amber-300"}>
                  {bots.telegram.reachable ? "OK" : bots.telegram.configured ? "FAIL" : "UNSET"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-white/45">{bots.telegram.detail}</p>
            </div>
            <div className="rounded-2xl border border-white/8 bg-[#12141c] px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Discord bot</p>
                <span className={bots.discord.reachable ? "text-emerald-400" : bots.discord.configured ? "text-red-400" : "text-amber-300"}>
                  {bots.discord.reachable ? "OK" : bots.discord.configured ? "FAIL" : "UNSET"}
                </span>
              </div>
              <p className="mt-1 text-[11px] text-white/45">{bots.discord.detail}</p>
              {!bots.discord.configured ? (
                <p className="mt-1 text-[10px] text-amber-300/80">Set DISCORD_BOT_TOKEN in Vercel env or Owner → Platforms.</p>
              ) : null}
            </div>
          </>
        ) : (
          <p className="text-[11px] text-white/40">Loading bot status…</p>
        )}
      </section>

      <section className="mb-4 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300/80">Discord invite probe</p>
        <input value={inviteInput} onChange={(e) => setInviteInput(e.target.value)} placeholder="discord.gg/… or invite code" className="w-full rounded-xl border border-white/10 bg-[#0c0e14] px-3 py-2.5 text-sm text-white placeholder:text-white/30 outline-none focus:border-cyan-400/40" />
        <button type="button" disabled={busy === "invite" || !inviteInput.trim()} onClick={() => void probeInvite()} className="w-full rounded-xl border border-violet-400/25 bg-violet-400/10 py-2.5 text-xs font-bold text-violet-200 disabled:opacity-50">Probe invite + bot-in-guild</button>
        {inviteResult ? <p className="text-[11px] text-white/55">{inviteResult}</p> : null}
      </section>

      {webhook ? (
        <div className="mb-3 rounded-2xl border border-white/8 bg-[#12141c] px-4 py-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Telegram webhook</p>
            <span className={webhook.status === "ok" ? "text-emerald-400" : webhook.status === "warn" ? "text-amber-300" : "text-red-400"}>{webhook.status}</span>
          </div>
          <p className="mt-1 text-[11px] text-white/45">{webhook.detail}</p>
        </div>
      ) : null}

      {switches ? (
        <section className="mb-4 space-y-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300/80">Kill switches</p>
          {switchRows.map(({ key, label }) => (
            <button key={key} type="button" disabled={busy === key} onClick={() => void toggle(key)} className="flex w-full items-center justify-between rounded-2xl border border-white/8 bg-[#12141c] px-4 py-3 text-left disabled:opacity-50">
              <span className="text-sm font-semibold">{label}</span>
              <span className={switches[key] ? "rounded-full bg-red-500/15 px-2.5 py-0.5 text-[10px] font-black text-red-300" : "rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-black text-emerald-300"}>
                {switches[key] ? "ON" : "OFF"}
              </span>
            </button>
          ))}
        </section>
      ) : null}

      <section className="mb-4 space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300/80">Fortress · manual cron</p>
        <div className="grid grid-cols-1 gap-2">
          <button type="button" disabled={busy === "membership"} onClick={() => void runCron("membership")} className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 py-2.5 text-xs font-bold text-emerald-200 disabled:opacity-50">Membership leave-check (TG + Discord · 20–72h)</button>
          <button type="button" disabled={busy === "nightly"} onClick={() => void runCron("nightly")} className="rounded-xl border border-violet-400/25 bg-violet-400/10 py-2.5 text-xs font-bold text-violet-200 disabled:opacity-50">Run strong nightly suite</button>
          <button type="button" disabled={busy === "wd"} onClick={() => void runCron("wd")} className="rounded-xl border border-cyan-400/25 bg-cyan-400/10 py-2.5 text-xs font-bold text-cyan-200 disabled:opacity-50">Alert stuck WDs</button>
          <button type="button" disabled={busy === "wd_sla"} onClick={() => void runCron("wd_sla")} className="rounded-xl border border-amber-400/25 bg-amber-400/10 py-2.5 text-xs font-bold text-amber-200 disabled:opacity-50">Run 12h WD SLA (flag + notify)</button>
          <button type="button" disabled={busy === "campaigns"} onClick={() => void runCron("campaigns")} className="rounded-xl border border-cyan-400/25 bg-cyan-400/10 py-2.5 text-xs font-bold text-cyan-200 disabled:opacity-50">Alert stuck campaigns</button>
          <button
            type="button"
            disabled={busy === "referral_audit"}
            onClick={() => {
              void (async () => {
                setBusy("referral_audit");
                setMsg(null);
                try {
                  const { ownerRunReferralAudit } = await import("@/lib/strong-p4.functions");
                  const r = await ownerRunReferralAudit({ data: { clawback: false, limit: 50 } });
                  setMsg(`Referral audit: ${r.checked} checked · ${r.failed} inactive · ${r.clawed} clawed`);
                } catch (e) {
                  setMsg(e instanceof Error ? e.message : "Referral audit failed");
                } finally {
                  setBusy(null);
                }
              })();
            }}
            className="rounded-xl border border-rose-400/25 bg-rose-400/10 py-2.5 text-xs font-bold text-rose-200 disabled:opacity-50"
          >
            Referral unlock audit (inactive referees)
          </button>
          <button
            type="button"
            disabled={busy === "clawback_pause"}
            onClick={() => {
              void (async () => {
                setBusy("clawback_pause");
                setMsg(null);
                try {
                  const { ownerPauseClawbackSpikeAdvertisers } = await import("@/lib/strong-p2.functions");
                  const r = await ownerPauseClawbackSpikeAdvertisers();
                  setMsg(`Clawback spike: paused ${r.paused} · checked ${r.advertisersChecked} advertisers`);
                } catch (e) {
                  setMsg(e instanceof Error ? e.message : "Clawback pause failed");
                } finally {
                  setBusy(null);
                }
              })();
            }}
            className="rounded-xl border border-orange-400/25 bg-orange-400/10 py-2.5 text-xs font-bold text-orange-200 disabled:opacity-50"
          >
            Pause high-clawback advertisers
          </button>
          <button
            type="button"
            disabled={busy === "zero_slots"}
            onClick={() => {
              void (async () => {
                setBusy("zero_slots");
                setMsg(null);
                try {
                  const { ownerAutoCloseZeroSlotTasks } = await import("@/lib/strong-p5.functions");
                  const r = await ownerAutoCloseZeroSlotTasks();
                  setMsg(`Auto-closed ${r.closed} zero-slot task(s)`);
                } catch (e) {
                  setMsg(e instanceof Error ? e.message : "Auto-close failed");
                } finally {
                  setBusy(null);
                }
              })();
            }}
            className="rounded-xl border border-sky-400/25 bg-sky-400/10 py-2.5 text-xs font-bold text-sky-200 disabled:opacity-50"
          >
            Auto-close zero-slot tasks
          </button>
        </div>
      </section>

      {data ? (
        <>
          <p className="mb-3 text-sm">Overall: <span className={data.overall === "ok" ? "text-emerald-400" : data.overall === "warn" ? "text-amber-300" : "text-red-400"}>{data.overall.toUpperCase()}</span></p>
          <div className="space-y-2">
            {data.checks.map((c) => (
              <div key={c.name} className="rounded-2xl border border-white/8 bg-[#12141c] px-4 py-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{c.name}</p>
                  <span className={c.status === "ok" ? "text-emerald-400" : c.status === "warn" ? "text-amber-300" : "text-red-400"}>{c.status}</span>
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
