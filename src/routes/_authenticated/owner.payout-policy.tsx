import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { OwnerShell } from "@/components/OwnerShell";
import {
  ownerGetPayoutPolicy,
  ownerSetPayoutPolicy,
  ownerGetNotificationSettings,
  ownerSetNotificationSettings,
} from "@/lib/owner-payout-policy.functions";
import {
  ownerGetCheckinNotificationSettings,
  ownerSetCheckinNotificationSettings,
  type CheckinNotificationSettings,
} from "@/lib/checkin-notification.functions";

const DEFAULT_TEMPLATE = [
  "✅ <b>Payout Successful!</b>",
  "",
  "💰 Amount: #amount USDT",
  "📍 Network: #method",
  "🧾 Ref: #reference",
  "",
  "🎉 Payment completed successfully.",
  "🕐 Time: #time",
].join("\n");

export const Route = createFileRoute("/_authenticated/owner/payout-policy")({
  loader: async () => {
    try {
      const [policy, notifications] = await Promise.all([
        ownerGetPayoutPolicy(),
        ownerGetNotificationSettings(),
      ]);
      return { policy, notifications, error: null as string | null };
    } catch (e) {
      return {
        policy: null,
        notifications: null,
        error: e instanceof Error ? e.message : "Owner access required",
      };
    }
  },
  component: Page,
});

function Page() {
  const initial = Route.useLoaderData();
  const [policy, setPolicy] = useState(initial.policy);
  const [settings, setSettings] = useState(initial.notifications);
  const [template, setTemplate] = useState(
    initial.notifications?.payout_message_template ?? DEFAULT_TEMPLATE,
  );
  const [message, setMessage] = useState(initial.error);
  const [saving, setSaving] = useState(false);
  const [savingImage, setSavingImage] = useState(false);
  const [checkin, setCheckin] = useState<CheckinNotificationSettings | null>(null);
  const [savingCheckin, setSavingCheckin] = useState(false);

  useEffect(() => {
    void ownerGetCheckinNotificationSettings().then(setCheckin).catch(() => undefined);
  }, []);

  async function saveCheckin() {
    if (!checkin) return;
    setSavingCheckin(true);
    setMessage(null);
    try {
      setCheckin(await ownerSetCheckinNotificationSettings({ data: checkin }));
      setMessage("Check-in reminder schedule saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save check-in schedule.");
    } finally {
      setSavingCheckin(false);
    }
  }

  async function saveNotifications() {
    setSavingImage(true);
    setMessage(null);
    try {
      const input = document.getElementById("payout-image") as HTMLInputElement | null;
      const file = input?.files?.[0];
      let dataUrl: string | undefined;

      if (file) {
        if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
        if (file.size > 3 * 1024 * 1024) throw new Error("Keep the payout image under 3 MB.");
        dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(new Error("Could not read image."));
          reader.readAsDataURL(file);
        });
      }

      const saved = await ownerSetNotificationSettings({
        data: {
          payout_message_template: template,
          payout_image_data_url: dataUrl,
          payout_image_file_name: file?.name,
        },
      });

      setSettings(saved);
      setTemplate(saved.payout_message_template ?? DEFAULT_TEMPLATE);
      if (input) input.value = "";
      setMessage("Notification settings saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSavingImage(false);
    }
  }

  async function savePolicy() {
    if (!policy) return;
    setSaving(true);
    setMessage(null);
    try {
      const result = await ownerSetPayoutPolicy({
        data: {
          risk_force_dual: Number(policy.risk_force_dual),
          risk_auto_freeze: Number(policy.risk_auto_freeze),
          max_withdrawals_per_day: Number(policy.max_withdrawals_per_day),
        },
      });
      setPolicy(result.policy);
      setMessage("Risk policy saved.");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  if (!policy) {
    return (
      <OwnerShell>
        <main className="mx-auto max-w-[1180px] px-4 py-6 text-white">
          <h1 className="text-xl font-bold">Telegram Notifications</h1>
          <p className="mt-2 text-sm text-amber-200">{message}</p>
        </main>
      </OwnerShell>
    );
  }

  return (
    <OwnerShell>
      <main className="mx-auto max-w-[1180px] px-4 pb-10 pt-5 text-white">
        <h1 className="text-xl font-bold">Telegram Notifications</h1>
        <p className="mt-1 text-xs text-white/45">
          Real task publishing, private user notifications and owner alerts.
        </p>

        {message ? (
          <p className="mt-3 rounded-xl border border-cyan-400/15 bg-cyan-400/5 px-3 py-2 text-xs text-cyan-200">
            {message}
          </p>
        ) : null}

        <section className="mt-5 rounded-2xl border border-blue-400/25 bg-[#0b1d36] p-4">
          <h2 className="text-sm font-semibold text-blue-200">🔔 Task Notification Channel</h2>
          <p className="mt-1 text-[11px] text-white/45">
            New active tasks automatically publish here. The old public payout feed has been removed.
          </p>
          <div className="mt-3 rounded-xl border border-white/10 bg-[#08172a] px-3 py-3">
            <p className="font-semibold">@TaskoraPlusNoti</p>
            <p className="mt-1 text-[11px] text-white/45">
              📢 @TaskoraPlus · 👥 @TaskoraCommunity · 🤖 @TaskoraPlusBot
            </p>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-blue-400/25 bg-[#0b1d36] p-4">
          <h2 className="text-sm font-semibold text-blue-200">💳 Private Payout Message</h2>
          <p className="mt-1 text-[11px] text-white/45">
            Sent only to the user's private Telegram bot chat after payment is marked Paid. The payout image is attached to that private message.
          </p>
          <textarea
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            rows={8}
            className="mt-3 w-full rounded-xl border border-white/10 bg-[#08172a] px-3 py-2 font-mono text-xs text-white"
          />
          <label className="mt-3 block text-[11px] text-white/50">
            🖼️ Payout image
            <input
              id="payout-image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="mt-1 block w-full rounded-xl border border-white/10 bg-[#08172a] px-3 py-2 text-xs"
            />
          </label>
          {settings?.payout_image_url ? (
            <img
              src={settings.payout_image_url}
              alt="Current payout image"
              className="mt-3 max-h-40 rounded-xl object-contain"
            />
          ) : null}
          <button
            type="button"
            disabled={savingImage}
            onClick={() => void saveNotifications()}
            className="mt-3 w-full rounded-xl bg-blue-600 py-3 text-sm font-bold disabled:opacity-50"
          >
            {savingImage ? "Saving…" : "Save payout notification"}
          </button>
        </section>

        {checkin ? (
          <section className="mt-5 rounded-2xl border border-amber-400/20 bg-[#0b1d36] p-4">
            <h2 className="text-sm font-semibold text-amber-200">📅 Daily Check-in Reminder</h2>
            <p className="mt-1 text-[11px] text-white/45">
              Choose the local time and time zone. The scheduler checks every 5 minutes and sends only once per user per day.
            </p>
            <label className="mt-3 flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-xs">
              <span>🔔 Send daily reminders</span>
              <input type="checkbox" checked={checkin.enabled} onChange={(e) => setCheckin({ ...checkin, enabled: e.target.checked })} />
            </label>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <label className="text-[11px] text-white/55">
                🕐 Local time
                <input type="time" value={checkin.time} onChange={(e) => setCheckin({ ...checkin, time: e.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-[#08172a] px-3 py-2.5 text-sm text-white" />
                <span className="mt-1 block text-[10px] text-white/35">Stored as 24-hour time; your device displays it in its normal clock format.</span>
              </label>
              <label className="text-[11px] text-white/55">
                🌍 Country / time zone
                <select value={checkin.timezone} onChange={(e) => setCheckin({ ...checkin, timezone: e.target.value })} className="mt-1 w-full rounded-xl border border-white/10 bg-[#08172a] px-3 py-2.5 text-sm text-white">
                  {typeof Intl !== "undefined" && (Intl as any).supportedValuesOf
                    ? (Intl as any).supportedValuesOf("timeZone").map((zone: string) => {
                        const city = zone.split("/").slice(-1)[0].replaceAll("_", " ");
                        const region = zone.split("/")[0];
                        return <option key={zone} value={zone}>{region} · {city} ({zone})</option>;
                      })
                    : <option value={checkin.timezone}>{checkin.timezone}</option>}
                </select>
                <span className="mt-1 block text-[10px] text-white/35">Uses the full IANA time-zone database, including daylight-saving changes.</span>
              </label>
            </div>
            <label className="mt-3 block text-[11px] text-white/55">
              💬 Reminder message
              <textarea value={checkin.message} onChange={(e) => setCheckin({ ...checkin, message: e.target.value })} rows={5} className="mt-1 w-full rounded-xl border border-white/10 bg-[#08172a] px-3 py-2 text-xs text-white" />
            </label>
            <button disabled={savingCheckin} onClick={() => void saveCheckin()} className="mt-3 w-full rounded-xl bg-amber-400 py-3 text-sm font-bold text-[#071221]">
              {savingCheckin ? "Saving…" : "Save check-in schedule"}
            </button>
          </section>
        ) : null}

        <section className="mt-5 space-y-3">
          <h2 className="text-sm font-semibold text-blue-200">🛡️ Payout Risk Controls</h2>
          <label className="block text-[11px] text-white/50">
            Force dual approval at risk ≥
            <input
              type="number"
              value={policy.risk_force_dual}
              onChange={(e) => setPolicy({ ...policy, risk_force_dual: Number(e.target.value) })}
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#0b1d36] px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-[11px] text-white/50">
            Auto-freeze at risk ≥
            <input
              type="number"
              value={policy.risk_auto_freeze}
              onChange={(e) => setPolicy({ ...policy, risk_auto_freeze: Number(e.target.value) })}
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#0b1d36] px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-[11px] text-white/50">
            Max withdrawal requests / 24h
            <input
              type="number"
              value={policy.max_withdrawals_per_day}
              onChange={(e) => setPolicy({ ...policy, max_withdrawals_per_day: Number(e.target.value) })}
              className="mt-1 w-full rounded-xl border border-white/10 bg-[#0b1d36] px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={saving}
            onClick={() => void savePolicy()}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save risk policy"}
          </button>
        </section>
      </main>
    </OwnerShell>
  );
}
