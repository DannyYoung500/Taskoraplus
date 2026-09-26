import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { OwnerShell } from "@/components/OwnerShell";
import {
  ownerGetCheckinNotificationSettings,
  ownerSetCheckinNotificationSettings,
  type CheckinNotificationSettings,
} from "@/lib/checkin-notification.functions";

export const Route = createFileRoute("/_authenticated/owner/checkin-notifications")({
  component: Page,
});

function Page() {
  const [settings, setSettings] = useState<CheckinNotificationSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void ownerGetCheckinNotificationSettings().then(setSettings).catch((e) => setMessage(e instanceof Error ? e.message : "Could not load settings."));
  }, []);

  async function save() {
    if (!settings) return;
    setSaving(true);
    setMessage("");
    try {
      setSettings(await ownerSetCheckinNotificationSettings({ data: settings }));
      setMessage("✅ Morning + night check-in schedule saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <OwnerShell>
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="rounded-3xl border border-white/10 bg-[#0b1d36] p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-400">Telegram Notifications</p>
          <h1 className="mt-1 text-2xl font-bold">📅 Check-in Reminders</h1>
          <p className="mt-2 text-sm text-white/50">
            TaskoraPlus will remind users twice a day — morning and night — using each user's own local time zone.
          </p>

          {settings ? (
            <>
              <label className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
                <span>🔔 Enable check-in reminders</span>
                <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} />
              </label>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-xs text-white/60">
                  🌅 Morning reminder
                  <input
                    type="time"
                    value={settings.morning_time}
                    onChange={(e) => setSettings({ ...settings, morning_time: e.target.value })}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#07152b] px-4 py-3 text-sm text-white"
                  />
                </label>
                <label className="text-xs text-white/60">
                  🌙 Night reminder
                  <input
                    type="time"
                    value={settings.night_time}
                    onChange={(e) => setSettings({ ...settings, night_time: e.target.value })}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#07152b] px-4 py-3 text-sm text-white"
                  />
                </label>
              </div>

              <div className="mt-4 rounded-2xl border border-blue-400/15 bg-blue-500/[0.06] p-4 text-xs text-slate-300">
                🌍 <span className="font-semibold text-white">All countries:</span> reminders are calculated in each user's saved device time zone, so users in Nigeria, the US, India, Europe, Asia, etc. receive them in their own morning/night — not one global clock.
              </div>

              <label className="mt-4 block text-xs text-white/60">
                💬 Reminder message
                <textarea
                  rows={6}
                  value={settings.message}
                  onChange={(e) => setSettings({ ...settings, message: e.target.value })}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-[#07152b] px-4 py-3 text-sm text-white"
                />
              </label>

              {message ? <p className="mt-3 text-sm text-blue-300">{message}</p> : null}

              <button
                type="button"
                disabled={saving}
                onClick={() => void save()}
                className="mt-4 w-full rounded-2xl bg-blue-500 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save morning + night schedule"}
              </button>
            </>
          ) : (
            <p className="mt-5 text-sm text-white/45">Loading notification settings…</p>
          )}
        </div>
      </main>
    </OwnerShell>
  );
}
