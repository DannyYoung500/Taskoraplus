import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  getTelegramGateSettings,
  saveTelegramGateSettings,
  type TelegramGateSettings,
} from "@/lib/telegram-gate.functions";

export const Route = createFileRoute("/_authenticated/owner/settings")({
  component: OwnerSettings,
});

function OwnerSettings() {
  const [gate, setGate] = useState<TelegramGateSettings | null>(null);
  const [loadingGate, setLoadingGate] = useState(true);
  const [savingGate, setSavingGate] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void getTelegramGateSettings()
      .then(setGate)
      .catch((error) => setMessage(error instanceof Error ? error.message : "Could not load Telegram Gate settings."))
      .finally(() => setLoadingGate(false));
  }, []);

  const saveGate = async () => {
    if (!gate) return;
    setSavingGate(true);
    setMessage(null);
    try {
      const saved = await saveTelegramGateSettings({ data: gate });
      setGate(saved);
      setMessage("Telegram Gate settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save Telegram Gate settings.");
    } finally {
      setSavingGate(false);
    }
  };

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <h1 className="text-xl font-bold">Platform settings</h1>
      <p className="mt-1 text-xs text-white/45">Operational defaults. Env-backed secrets stay on Vercel (never in the browser).</p>

      <div className="mt-4 space-y-3">
        {[
          { k: "Min withdrawal", v: "$10.00" },
          { k: "Payout methods", v: "USDT TRC20 · BEP20 · BTC · TON" },
          { k: "Referral share", v: "8% of verified rewards" },
          { k: "Daily check-in", v: "$0.10" },
          { k: "Owner Telegram IDs", v: "TASKORA_OWNER_TELEGRAM_IDS (server)" },
          { k: "Bot token", v: "TELEGRAM_BOT_TOKEN (server)" },
        ].map((row) => (
          <div key={row.k} className="flex items-center justify-between rounded-2xl border border-white/8 bg-[#12141c] px-4 py-3">
            <span className="text-sm text-white/70">{row.k}</span>
            <span className="text-xs font-semibold text-amber-300">{row.v}</span>
          </div>
        ))}
      </div>

      <section className="mt-6 rounded-3xl border border-amber-300/10 bg-[#12141c] p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Telegram Gate</h2>
            <p className="mt-1 text-[11px] text-white/40">Require membership in your official Telegram channel before TASKORA access.</p>
          </div>
          <button type="button" disabled={loadingGate || !gate} onClick={() => gate && setGate({ ...gate, enabled: !gate.enabled })} className={`relative h-7 w-12 rounded-full transition ${gate?.enabled ? "bg-amber-400" : "bg-white/10"}`} aria-label="Toggle Telegram Gate">
            <span className={`absolute top-1 size-5 rounded-full bg-white transition ${gate?.enabled ? "left-6" : "left-1"}`} />
          </button>
        </div>

        {gate ? (
          <div className="mt-4 space-y-3">
            <Field label="Channel ID" value={gate.channelId} placeholder="@taskora_channel or -100..." onChange={(v) => setGate({ ...gate, channelId: v })} />
            <Field label="Channel URL" value={gate.channelUrl} placeholder="https://t.me/yourchannel" onChange={(v) => setGate({ ...gate, channelUrl: v })} />
            <Field label="Channel name" value={gate.channelName} onChange={(v) => setGate({ ...gate, channelName: v })} />
            <Field label="Gate title" value={gate.title} onChange={(v) => setGate({ ...gate, title: v })} />
            <Field label="Description" value={gate.description} onChange={(v) => setGate({ ...gate, description: v })} multiline />
            <Field label="Join button" value={gate.joinButtonText} onChange={(v) => setGate({ ...gate, joinButtonText: v })} />
            <Field label="Check button" value={gate.checkButtonText} onChange={(v) => setGate({ ...gate, checkButtonText: v })} />
            <Field label="Recheck interval (seconds)" value={String(gate.checkIntervalSeconds)} onChange={(v) => setGate({ ...gate, checkIntervalSeconds: Number(v) || 300 })} type="number" />

            <Toggle label="Admins can pass" checked={gate.allowAdmins} onChange={(v) => setGate({ ...gate, allowAdmins: v })} />
            <Toggle label="Channel creator can pass" checked={gate.allowCreators} onChange={(v) => setGate({ ...gate, allowCreators: v })} />
            <Toggle label="Members can pass" checked={gate.allowMembers} onChange={(v) => setGate({ ...gate, allowMembers: v })} />
            <Toggle label="Restricted members can pass" checked={gate.allowRestricted} onChange={(v) => setGate({ ...gate, allowRestricted: v })} />
            <Toggle label="Remove access after leaving" checked={gate.revokeOnLeave} onChange={(v) => setGate({ ...gate, revokeOnLeave: v })} />

            <button type="button" disabled={savingGate} onClick={saveGate} className="w-full rounded-2xl px-4 py-3 text-sm font-extrabold text-[#05070c] disabled:opacity-50" style={{ background: "linear-gradient(135deg, #FFE08A, #F5C542, #C9961A)" }}>
              {savingGate ? "SAVING…" : "SAVE TELEGRAM GATE"}
            </button>
            {message ? <p className="text-center text-xs text-white/55">{message}</p> : null}
          </div>
        ) : loadingGate ? (
          <p className="mt-4 text-xs text-white/35">Loading Telegram Gate settings…</p>
        ) : null}
      </section>

      <p className="mt-4 text-[11px] text-white/40">The Telegram bot token remains server-side and is never shown in this UI.</p>
    </main>
  );
}

function Field({ label, value, placeholder, onChange, multiline = false, type = "text" }: { label: string; value: string; placeholder?: string; onChange: (value: string) => void; multiline?: boolean; type?: string }) {
  const className = "mt-1 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/20 focus:border-amber-300/40";
  return (
    <label className="block text-xs text-white/55">
      {label}
      {multiline ? <textarea className={className} rows={3} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} /> : <input className={className} type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />}
    </label>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-xl border border-white/8 bg-black/15 px-3 py-3 text-xs text-white/65">
      {label}
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-4 accent-amber-400" />
    </label>
  );
}
