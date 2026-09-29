import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ChevronLeft,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Link2,
  Coins,
  Shield,
} from "lucide-react";
import {
  getTelegramGateSettings,
  saveTelegramGateSettings,
  previewTelegramGateChats,
  testTelegramGateConnection,
  getTelegramGateAnalytics,
  type TelegramGateSettings,
  type TelegramGateChat,
} from "@/lib/telegram-gate.functions";
import {
  ownerGetEconomy,
  ownerSaveEconomy,
  ownerGetWebhookInfo,
  ownerRegisterWebhook,
  ownerDeleteWebhook,
  type EconomySettings,
} from "@/lib/owner-economy.functions";

export const Route = createFileRoute("/_authenticated/owner/settings")({
  component: OwnerSettings,
});

function blankChat(type: "channel" | "group"): TelegramGateChat {
  return {
    id: "",
    type,
    url: "",
    name: type === "channel" ? "Telegram Channel" : "Telegram Group",
    verified: false,
    photoUrl: null,
    botIsAdmin: null,
    username: null,
    memberCount: null,
    description: null,
    error: null,
  };
}

function OwnerSettings() {
  const [tab, setTab] = useState<"economy" | "webhook" | "gate">("economy");
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [analytics, setAnalytics] = useState<any>(null);
  const [testResult, setTestResult] = useState<any>(null);

  useEffect(() => {
    void (async () => {
      try {
        const [g, eco, wh] = await Promise.all([
          getTelegramGateSettings().catch(() => null),
          ownerGetEconomy().catch(() => null),
          ownerGetWebhookInfo().catch(() => null),
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
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "Could not load settings.");
      } finally {
        setLoading(false);
      }
      try {
        setAnalytics(await getTelegramGateAnalytics());
      } catch {
        /* ignore */
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
          <p className="text-[11px] text-white/45">Economy · Webhook · Gate</p>
        </div>
      </div>

      <div className="mb-4 flex gap-1 rounded-2xl border border-white/10 bg-[#0b1d36] p-1">
        {([["economy", "Economy", Coins], ["webhook", "Webhook", Link2], ["gate", "Gate", Shield]] as const).map(([id, label, Icon]) => (
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
            <h2 className="text-base font-bold text-blue-200">Command Center · Economy</h2>
            <p className="mt-1 text-[11px] text-white/40">Live limits, fees, pauses. Changes apply to new deposits, withdrawals and tasks.</p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#12141c] p-4 space-y-3">
            <NumField label="Min deposit (USDT)" value={economy.min_deposit_usd} onChange={(v) => setEconomy({ ...economy, min_deposit_usd: v })} />
            <NumField label="Min withdrawal (USDT)" value={economy.min_withdrawal_usd} onChange={(v) => setEconomy({ ...economy, min_withdrawal_usd: v })} />
            <NumField label="First withdrawal max (USDT)" value={economy.first_withdrawal_max_usd} onChange={(v) => setEconomy({ ...economy, first_withdrawal_max_usd: v })} />
            <NumField label="Platform fee %" value={economy.platform_fee_pct} onChange={(v) => setEconomy({ ...economy, platform_fee_pct: v })} />
            <NumField label="Referral %" value={economy.referral_pct} onChange={(v) => setEconomy({ ...economy, referral_pct: v })} />
            <NumField label="Feature boost fee (USDT)" value={economy.feature_boost_fee_usd} onChange={(v) => setEconomy({ ...economy, feature_boost_fee_usd: v })} />
            <NumField label="Dual-approval threshold (USDT)" value={economy.dual_approval_threshold_usd} onChange={(v) => setEconomy({ ...economy, dual_approval_threshold_usd: v })} />
            <NumField label="Watch & Earn rate / hour (USDT)" value={economy.watch_earn_rate_per_hour_usdt} onChange={(v) => setEconomy({ ...economy, watch_earn_rate_per_hour_usdt: v })} />
            <NumField label="Watch & Earn daily cap (USDT)" value={economy.watch_earn_daily_cap_usdt} onChange={(v) => setEconomy({ ...economy, watch_earn_daily_cap_usdt: v })} />
            <NumField label="Bonus ad reward (USDT)" value={Number((economy as any).bonus_ad_reward_usdt ?? 0.003)} onChange={(v) => setEconomy({ ...economy, bonus_ad_reward_usdt: v } as any)} />
            <NumField label="Bonus ad daily limit" value={Number((economy as any).bonus_ad_daily_limit ?? 5)} onChange={(v) => setEconomy({ ...economy, bonus_ad_daily_limit: v } as any)} />
            <NumField label="Daily check-in Task Points" value={economy.daily_checkin_points} onChange={(v) => setEconomy({ ...economy, daily_checkin_points: v })} />
            <NumField label="Successful referral Task Points" value={economy.referral_points} onChange={(v) => setEconomy({ ...economy, referral_points: v })} />
          </div>

          <div className="rounded-3xl border border-white/10 bg-[#12141c] p-4 space-y-2">
            <Toggle label="Dual approval for large withdrawals" on={economy.dual_approval_enabled} onChange={(v) => setEconomy({ ...economy, dual_approval_enabled: v })} />
            <Toggle label="Pause all payouts" on={economy.payouts_paused} onChange={(v) => setEconomy({ ...economy, payouts_paused: v })} danger />
            <Toggle label="Pause new tasks" on={economy.tasks_paused} onChange={(v) => setEconomy({ ...economy, tasks_paused: v })} danger />
            <Toggle label="Watch & Earn enabled" on={economy.watch_earn_enabled} onChange={(v) => setEconomy({ ...economy, watch_earn_enabled: v })} />
          </div>

          <button type="button" disabled={saving} onClick={() => void saveEconomy()} className="w-full rounded-2xl bg-sky-400 px-4 py-3.5 text-sm font-extrabold text-[#05070c] disabled:opacity-50">
            {saving ? "SAVING…" : "SAVE ECONOMY CONTROLS"}
          </button>
        </section>
      ) : null}

      {tab === "webhook" ? (
        <section className="space-y-3">
          <div className="rounded-3xl border border-blue-400/20 bg-[#12141c] p-4">
            <h2 className="text-base font-bold text-blue-200">Telegram webhook</h2>
            <p className="mt-1 text-[11px] text-white/40">Register the bot webhook so /start welcome and updates work.</p>
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
            <p className="text-[10px] text-white/40">Bot: {webhook?.botUsername ? `@${webhook.botUsername}` : "—"} · Pending: {webhook?.pending ?? 0}</p>
          </div>
        </section>
      ) : null}

      {tab === "gate" && gate ? (
        <section className="space-y-3">
          <div className="rounded-3xl border border-blue-400/20 bg-[#12141c] p-4">
            <h2 className="text-base font-bold text-blue-200">Telegram Gate</h2>
            <p className="mt-1 text-[11px] text-white/40">Require channel/group join before app access.</p>
          </div>
          <p className="text-center text-xs text-white/50">Use full Owner Settings in a prior build for full gate chat management, or open Gate from Owner index.</p>
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
