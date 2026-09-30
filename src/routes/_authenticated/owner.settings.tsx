import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  Loader2,
  Link2,
  Coins,
  Shield,
  Bell,
} from "lucide-react";
import {
  getTelegramGateSettings,
  type TelegramGateSettings,
} from "@/lib/telegram-gate.functions";
import {
  ownerGetEconomy,
  ownerSaveEconomy,
  ownerGetWebhookInfo,
  ownerRegisterWebhook,
  ownerDeleteWebhook,
  type EconomySettings,
} from "@/lib/owner-economy.functions";
import {
  ownerGetTaskNotifyChannel,
  ownerSetTaskNotifyChannel,
  ownerGetOpsChannel,
  ownerSetOpsChannel,
} from "@/lib/notify-owner";

export const Route = createFileRoute("/_authenticated/owner/settings")({
  component: OwnerSettings,
});

function OwnerSettings() {
  const [tab, setTab] = useState<"economy" | "webhook" | "gate" | "channels">("economy");
  const [gate, setGate] = useState<TelegramGateSettings | null>(null);
  const [economy, setEconomy] = useState<EconomySettings | null>(null);
  const [webhook, setWebhook] = useState<{
    configured: boolean;
    url: string | null;
    pending: number;
    lastError: string | null;
    botUsername: string | null;
    error: string | null;
  } | null>(null);
  const [webhookUrlInput, setWebhookUrlInput] = useState("");
  const [taskChannelId, setTaskChannelId] = useState("");
  const [opsChannelId, setOpsChannelId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const [g, eco, wh, tc, oc] = await Promise.all([
          getTelegramGateSettings().catch(() => null),
          ownerGetEconomy().catch(() => null),
          ownerGetWebhookInfo().catch(() => null),
          ownerGetTaskNotifyChannel().catch(() => null),
          ownerGetOpsChannel().catch(() => null),
        ]);
        if (g) {
          setGate({
            ...g,
            revokeOnLeave: true,
            requiredChats: Array.isArray(g.requiredChats) ? g.requiredChats : [],
          });
        }
        if (eco) setEconomy(eco);
        if (wh) {
          setWebhook(wh);
          setWebhookUrlInput(wh.url || (wh as any).suggestedUrl || "https://taskoraplusapp.vercel.app/api/telegram-webhook");
        }
        if (tc?.channel_id) setTaskChannelId(tc.channel_id);
        if (oc?.channel_id) setOpsChannelId(oc.channel_id);
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Could not load settings.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function saveEconomy() {
    if (!economy) return;
    setSaving(true);
    setMessage("");
    try {
      const r = await ownerSaveEconomy({ data: economy });
      setEconomy(r.economy);
      setMessage("✓ Economy controls saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save economy.");
    } finally {
      setSaving(false);
    }
  }

  async function saveTaskChannel() {
    setSaving(true);
    setMessage("");
    try {
      const r = await ownerSetTaskNotifyChannel({ data: { channelId: taskChannelId.trim() } });
      setTaskChannelId(r.channel_id);
      setMessage("✓ Task notification channel saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save task channel.");
    } finally {
      setSaving(false);
    }
  }

  async function saveOpsChannel() {
    setSaving(true);
    setMessage("");
    try {
      const r = await ownerSetOpsChannel({ data: { channelId: opsChannelId.trim() } });
      setOpsChannelId(r.channel_id);
      setMessage("✓ Ops channel saved. Withdrawals & alerts post here.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save ops channel.");
    } finally {
      setSaving(false);
    }
  }

  async function registerWebhook() {
    setSaving(true);
    setMessage("");
    try {
      const r = await ownerRegisterWebhook({ data: { url: webhookUrlInput.trim() || undefined } });
      setMessage(`✓ Webhook registered: ${r.url}`);
      const wh = await ownerGetWebhookInfo();
      setWebhook(wh);
      if (wh.url) setWebhookUrlInput(wh.url);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Webhook registration failed.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteWebhook() {
    if (!window.confirm("Remove the Telegram webhook?")) return;
    setSaving(true);
    setMessage("");
    try {
      await ownerDeleteWebhook();
      setMessage("✓ Webhook removed.");
      const wh = await ownerGetWebhookInfo();
      setWebhook(wh);
      setWebhookUrlInput("");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Delete failed.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center bg-[#05070c] text-white">
        <Loader2 className="size-6 animate-spin text-sky-300" />
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1180px] bg-[#07152b] px-4 pb-28 pt-5 text-white">
      <div className="mb-4 flex items-center gap-2">
        <Link to="/owner" className="rounded-full border border-white/10 p-2 text-white/60">
          <ChevronLeft className="size-4" />
        </Link>
        <div className="flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">Owner</p>
          <h1 className="text-xl font-bold">Command Center</h1>
          <p className="text-[11px] text-white/45">Economy · Channels · Webhook · Gate</p>
        </div>
      </div>

      <div className="mb-4 flex gap-1 rounded-2xl border border-white/10 bg-[#0b1d36] p-1">
        {([["economy", "Economy", Coins], ["channels", "Channels", Bell], ["webhook", "Webhook", Link2], ["gate", "Gate", Shield]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            type="button"
            onClick={() => { setTab(id); setMessage(""); }}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[11px] font-bold transition ${
              tab === id ? "bg-sky-500 text-[#05070c]" : "text-white/50 hover:text-white/80"
            }`}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      {message ? (
        <p className="mb-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-center text-xs text-white/70">{message}</p>
      ) : null}

      {tab === "economy" && economy ? (
        <section className="space-y-3">
          <div className="rounded-3xl border border-blue-400/20 bg-[#12141c] p-4">
            <h2 className="text-base font-bold text-blue-200">Economy</h2>
            <p className="mt-1 text-[11px] text-white/40">USDT limits & pauses. Task Points removed.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-[#12141c] p-4 space-y-3">
            <NumField label="Min deposit (USDT)" value={economy.min_deposit_usd} onChange={(v) => setEconomy({ ...economy, min_deposit_usd: v })} />
            <NumField label="Min withdrawal (USDT)" value={economy.min_withdrawal_usd} onChange={(v) => setEconomy({ ...economy, min_withdrawal_usd: v })} />
            <NumField label="First withdrawal max (USDT)" value={economy.first_withdrawal_max_usd} onChange={(v) => setEconomy({ ...economy, first_withdrawal_max_usd: v })} />
            <NumField label="Platform fee %" value={economy.platform_fee_pct} onChange={(v) => setEconomy({ ...economy, platform_fee_pct: v })} />
            <NumField label="Referral %" value={economy.referral_pct} onChange={(v) => setEconomy({ ...economy, referral_pct: v })} />
            <NumField label="Dual-approval threshold (USDT)" value={economy.dual_approval_threshold_usd} onChange={(v) => setEconomy({ ...economy, dual_approval_threshold_usd: v })} />
            <NumField label="Watch rate / hour (USDT)" value={economy.watch_earn_rate_per_hour_usdt} onChange={(v) => setEconomy({ ...economy, watch_earn_rate_per_hour_usdt: v })} />
            <NumField label="Watch daily cap (USDT)" value={economy.watch_earn_daily_cap_usdt} onChange={(v) => setEconomy({ ...economy, watch_earn_daily_cap_usdt: v })} />
            <NumField label="Bonus ad reward (USDT)" value={Number((economy as any).bonus_ad_reward_usdt ?? 0.003)} onChange={(v) => setEconomy({ ...economy, bonus_ad_reward_usdt: v } as any)} />
            <NumField label="Bonus ad daily limit" value={Number((economy as any).bonus_ad_daily_limit ?? 5)} onChange={(v) => setEconomy({ ...economy, bonus_ad_daily_limit: v } as any)} />
          </div>
          <div className="rounded-3xl border border-white/10 bg-[#12141c] p-4 space-y-2">
            <Toggle label="Dual approval for large withdrawals" on={economy.dual_approval_enabled} onChange={(v) => setEconomy({ ...economy, dual_approval_enabled: v })} />
            <Toggle label="Pause all payouts" on={economy.payouts_paused} onChange={(v) => setEconomy({ ...economy, payouts_paused: v })} danger />
            <Toggle label="Pause new tasks" on={economy.tasks_paused} onChange={(v) => setEconomy({ ...economy, tasks_paused: v })} danger />
            <Toggle label="Watch & Earn enabled" on={economy.watch_earn_enabled} onChange={(v) => setEconomy({ ...economy, watch_earn_enabled: v })} />
          </div>
          <button type="button" disabled={saving} onClick={() => void saveEconomy()} className="w-full rounded-2xl bg-sky-400 px-4 py-3.5 text-sm font-extrabold text-[#05070c] disabled:opacity-50">
            {saving ? "SAVING…" : "SAVE ECONOMY"}
          </button>
        </section>
      ) : null}

      {tab === "channels" ? (
        <section className="space-y-3">
          <div className="rounded-3xl border border-blue-400/20 bg-[#12141c] p-4">
            <h2 className="text-base font-bold text-blue-200">Task notification channel</h2>
            <p className="mt-1 text-[11px] text-white/40">Posts when you activate a task. Bot must be channel admin.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-[#12141c] p-4 space-y-3">
            <label className="block text-xs text-white/55">
              Channel @username or chat ID
              <input className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400/40" value={taskChannelId} onChange={(e) => setTaskChannelId(e.target.value)} placeholder="@your_task_channel or -100…" />
            </label>
            <button type="button" disabled={saving} onClick={() => void saveTaskChannel()} className="w-full rounded-2xl bg-sky-400 px-4 py-3 text-sm font-extrabold text-[#05070c] disabled:opacity-50">
              {saving ? "SAVING…" : "SAVE TASK CHANNEL"}
            </button>
          </div>
          <div className="rounded-3xl border border-amber-400/20 bg-[#12141c] p-4">
            <h2 className="text-base font-bold text-amber-200">Private ops channel</h2>
            <p className="mt-1 text-[11px] text-white/40">Withdrawals, paid/failed, velocity alerts. Private channel recommended. Also mirrors to owner DMs.</p>
          </div>
          <div className="rounded-3xl border border-white/10 bg-[#12141c] p-4 space-y-3">
            <label className="block text-xs text-white/55">
              Ops channel @username or chat ID
              <input className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400/40" value={opsChannelId} onChange={(e) => setOpsChannelId(e.target.value)} placeholder="@taskora_ops or -100…" />
            </label>
            <button type="button" disabled={saving} onClick={() => void saveOpsChannel()} className="w-full rounded-2xl bg-amber-400 px-4 py-3 text-sm font-extrabold text-[#05070c] disabled:opacity-50">
              {saving ? "SAVING…" : "SAVE OPS CHANNEL"}
            </button>
            <p className="text-[10px] text-white/40">Env: TASKORA_OPS_CHANNEL_ID</p>
          </div>
        </section>
      ) : null}

      {tab === "webhook" ? (
        <section className="space-y-3">
          <div className="rounded-3xl border border-blue-400/20 bg-[#12141c] p-4">
            <h2 className="text-base font-bold text-blue-200">Telegram webhook</h2>
          </div>
          <div className="rounded-3xl border border-white/10 bg-[#12141c] p-4 space-y-3">
            <label className="block text-xs text-white/55">
              Webhook URL
              <input className="mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none focus:border-sky-400/40" value={webhookUrlInput} onChange={(e) => setWebhookUrlInput(e.target.value)} />
            </label>
            <div className="flex gap-2">
              <button type="button" disabled={saving} onClick={() => void registerWebhook()} className="flex-1 rounded-xl bg-sky-400 py-2.5 text-xs font-bold text-[#05070c] disabled:opacity-50">Register</button>
              <button type="button" disabled={saving} onClick={() => void deleteWebhook()} className="rounded-xl border border-red-400/30 px-4 py-2.5 text-xs font-bold text-red-300 disabled:opacity-50">Delete</button>
            </div>
            <p className="text-[10px] text-white/40">Bot: {webhook?.botUsername ? `@${webhook.botUsername}` : "—"}</p>
          </div>
        </section>
      ) : null}

      {tab === "gate" ? (
        <section className="space-y-3">
          <div className="rounded-3xl border border-blue-400/20 bg-[#12141c] p-4">
            <h2 className="text-base font-bold text-blue-200">Telegram Gate</h2>
            <p className="mt-1 text-[11px] text-white/40">Open Gate from Owner index for full management.</p>
          </div>
        </section>
      ) : null}
    </main>
  );
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 text-xs text-white/55">
      <span className="min-w-0 flex-1">{label}</span>
      <input type="number" step="any" className="w-24 rounded-xl border border-white/10 bg-black/20 px-2.5 py-2 text-right text-sm font-semibold text-white outline-none focus:border-sky-400/40" value={Number.isFinite(value) ? value : 0} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

function Toggle({ label, on, onChange, danger }: { label: string; on: boolean; onChange: (v: boolean) => void; danger?: boolean }) {
  return (
    <button type="button" onClick={() => onChange(!on)} className="flex w-full items-center justify-between gap-3 py-1.5 text-left">
      <span className={`text-xs ${danger && on ? "text-red-300" : "text-white/80"}`}>{label}</span>
      <span className={`relative h-6 w-11 rounded-full transition ${on ? (danger ? "bg-red-500" : "bg-sky-500") : "bg-white/15"}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white shadow transition ${on ? "left-5" : "left-0.5"}`} />
      </span>
    </button>
  );
}
