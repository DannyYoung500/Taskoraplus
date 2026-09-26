import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { sendUserHtml } from "@/lib/notify-user";

function localClock(timezone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date());
  return { hour: parts.find((p) => p.type === "hour")?.value ?? "", minute: parts.find((p) => p.type === "minute")?.value ?? "" };
}

function localDate(timezone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

async function run(request: Request) {
  const denied = await authenticateCronRequest(request);
  if (denied) return denied;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: row } = await (supabaseAdmin as any).from("app_settings").select("value").eq("key", "checkin_notifications").maybeSingle();
  const settings = ((row as any)?.value ?? {}) as { enabled?: boolean; time?: string; timezone?: string; message?: string };
  if (settings.enabled === false) return Response.json({ ok: true, sent: 0, skipped: "disabled" });

  const time = /^([01]\d|2[0-3]):[0-5]\d$/.test(String(settings.time ?? "")) ? String(settings.time) : "09:00";
  const timezone = String(settings.timezone ?? "Africa/Lagos");
  const clock = localClock(timezone);
  if (`${clock.hour}:${clock.minute}` !== time) return Response.json({ ok: true, sent: 0, skipped: "not_due", time, timezone });

  const date = localDate(timezone);
  const { data: lastRun } = await (supabaseAdmin as any).from("app_settings").select("value").eq("key", "checkin_notifications_last_run").maybeSingle();
  if ((lastRun as any)?.value?.date === date && (lastRun as any)?.value?.time === time) return Response.json({ ok: true, sent: 0, skipped: "already_sent", date, time, timezone });

  const { data: profiles } = await supabaseAdmin.from("profiles").select("id, telegram_id, last_checkin").not("telegram_id", "is", null).limit(5000);
  let sent = 0;
  for (const profile of profiles ?? []) {
    if (!profile.telegram_id || profile.last_checkin === date) continue;
    const result = await sendUserHtml({
      userId: String(profile.id),
      text: String(settings.message || "📅 <b>Check-in Reminder</b>\n\n⏰ You haven't checked in today!\n🔥 Keep your streak going and earn more 🎯 Task Points.\n\n👇 Check in now to claim today's points."),
      buttons: [{ text: "📅 Check In Now", url: "https://t.me/TaskoraPlusBot" }],
    });
    if (result.ok) sent++;
  }

  await (supabaseAdmin as any).from("app_settings").upsert({ key: "checkin_notifications_last_run", value: { date, time, timezone, sent, at: new Date().toISOString() } }, { onConflict: "key" });
  return Response.json({ ok: true, sent, date, time, timezone });
}

export const Route = createFileRoute("/api/cron/checkin-reminders")({
  server: {
    handlers: {
      GET: async ({ request }) => run(request),
      POST: async ({ request }) => run(request),
    },
  },
});
