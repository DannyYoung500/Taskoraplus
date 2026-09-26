import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { sendUserHtml } from "@/lib/notify-user";

function localParts(timezone: string) {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, hour: get("hour"), minute: get("minute") };
}

function due(target: string, minute: string) {
  const targetMinute = Number(target.split(":")[1]);
  const currentMinute = Number(minute);
  // Cron runs every five minutes; accept the first five-minute window after the configured minute.
  return Number.isFinite(targetMinute) && Number.isFinite(currentMinute)
    ? (currentMinute - targetMinute + 60) % 60 < 5
    : false;
}

async function run(request: Request) {
  const denied = await authenticateCronRequest(request);
  if (denied) return denied;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await (supabaseAdmin as any).from("app_settings").select("value").eq("key", "checkin_notifications").maybeSingle();
  const settings = ((row as any)?.value ?? {}) as {
    enabled?: boolean;
    morning_time?: string;
    night_time?: string;
    message?: string;
  };
  if (settings.enabled === false) return Response.json({ ok: true, sent: 0, skipped: "disabled" });

  const morning = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(settings.morning_time ?? "")) ? String(settings.morning_time) : "09:00";
  const night = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(settings.night_time ?? "")) ? String(settings.night_time) : "21:00";
  const message = String(settings.message || "📅 Check-in Reminder\n\n⏰ You haven't checked in today!\n🔥 Keep your streak going and earn more 🎯 Task Points.\n\n👇 Check in now to claim today's points.");

  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, telegram_id, last_checkin, timezone, country_code")
    .not("telegram_id", "is", null)
    .limit(10000);

  let sent = 0;
  let considered = 0;

  for (const profile of profiles ?? []) {
    if (!profile.telegram_id) continue;
    const timezone = String((profile as any).timezone || "UTC");
    let local;
    try {
      local = localParts(timezone);
    } catch {
      local = localParts("UTC");
    }

    const slot = due(morning, local.minute) && local.hour === morning.slice(0, 2)
      ? "morning"
      : due(night, local.minute) && local.hour === night.slice(0, 2)
        ? "night"
        : null;
    if (!slot) continue;
    considered++;

    // A user who already checked in today does not need another reminder.
    if (String(profile.last_checkin ?? "") === local.date) continue;

    const { data: claimed, error: claimError } = await (supabaseAdmin as any)
      .from("checkin_reminder_deliveries")
      .insert({
        user_id: profile.id,
        reminder_date: local.date,
        slot,
      })
      .select("id")
      .maybeSingle();

    if (claimError || !claimed) continue;

    const result = await sendUserHtml({
      userId: String(profile.id),
      text: message,
      buttons: [{ text: "📅 Check In Now", url: "https://t.me/TaskoraPlusBot" }],
    });
    if (result.ok) sent++;
  }

  return Response.json({ ok: true, sent, considered });
}

export const Route = createFileRoute("/api/cron/checkin-reminders")({
  server: {
    handlers: {
      GET: async ({ request }) => run(request),
      POST: async ({ request }) => run(request),
    },
  },
});
