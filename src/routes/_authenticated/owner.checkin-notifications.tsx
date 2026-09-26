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
      setMessage("✅ Daily check-in notification schedule saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save settings.");
    } finally {
      setSaving(false);
    }
  }

  const zones = typeof Intl !== "undefined" && (Intl as any).supportedValuesOf
    ? ((Intl as any).supportedValuesOf("timeZone") as string[])
    : ["Africa/Lagos", "Europe/London", "America/New_York", "Asia/Dubai", "Asia/Kolkata", "Asia/Tokyo", "Australia/Sydney"];

  return (
    <OwnerShell>
      <main className="mx-auto w-full max-w-3xl px-4 py-6">
        <div className="rounded-3xl border border-white/10 bg-[#0b1d36] p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-blue-400">Telegram Notifications</p>
          <h1 className="mt-1 text-2xl font-bold">📅 Daily Check-in Reminder</h1>
          <p className="mt-2 text-sm text-white/50">
            Choose when TaskoraPlus should privately remind users who have not checked in that day.
          </p>

          {settings ? (
            <>
              <label className="mt-5 flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm">
                <span>🔔 Enable daily reminders</span>
                <input type="checkbox" checked={settings.enabled} onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })} />
              </label>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="text-xs text-white/60">
                  🕐 Reminder time
                  <input
                    type="time"
                    value={settings.time}
                    onChange={(e) => setSettings({ ...settings, time: e.target.value })}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#07152b] px-4 py-3 text-sm text-white"
                  />
                  <span className="mt-1 block text-[10px] text-white/35">Stored as 24-hour time; the device displays it in its normal local clock format.</span>
                </label>

                <label className="text-xs text-white/60">
                  🌍 Country / time zone
                  <select
                    value={settings.timezone}
                    onChange={(e) => setSettings({ ...settings, timezone: e.target.value })}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-[#07152b] px-4 py-3 text-sm text-white"
                  >
                    {zones.map((zone) => {
                      const parts = zone.split("/");
                      const city = parts[parts.length - 1].replaceAll("_", " ");
                      const region = parts[0];
                      return <option key={zone} value={zone}>{region} · {city} ({zone})</option>;
                    })}
                  </select>
                  <span className="mt-1 block text-[10px] text-white/35">Uses the full IANA time-zone database, including daylight-saving changes.</span>
                </label>
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
                {saving ? "Saving…" : "Save reminder schedule"}
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
