import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertOwner } from "@/lib/owner-guard.server";

export type CheckinNotificationSettings = {
  enabled: boolean;
  time: string;
  timezone: string;
  message: string;
};

const DEFAULTS: CheckinNotificationSettings = {
  enabled: true,
  time: "09:00",
  timezone: "Africa/Lagos",
  message:
    "📅 <b>Check-in Reminder</b>\\n\\n⏰ You haven't checked in today!\\n🔥 Keep your streak going and earn more 🎯 Task Points.\\n\\n👇 Check in now to claim today's points.",
};

async function readSettings() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", "checkin_notifications").maybeSingle();
  const value = (data?.value ?? {}) as Partial<CheckinNotificationSettings>;
  return {
    ...DEFAULTS,
    ...value,
    enabled: value.enabled !== false,
    time: /^([01]\\d|2[0-3]):[0-5]\\d$/.test(String(value.time ?? "")) ? String(value.time) : DEFAULTS.time,
    timezone: String(value.timezone ?? DEFAULTS.timezone),
    message: String(value.message ?? DEFAULTS.message).slice(0, 3500),
  };
}

export const ownerGetCheckinNotificationSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    return readSettings();
  });

export const ownerSetCheckinNotificationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: CheckinNotificationSettings) => d)
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    if (!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(data.time)) throw new Error("Use a valid 24-hour time such as 09:00.");
    if (!data.timezone || data.timezone.length > 100) throw new Error("Choose a valid time zone.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const value = {
      enabled: Boolean(data.enabled),
      time: data.time,
      timezone: data.timezone,
      message: String(data.message || DEFAULTS.message).slice(0, 3500),
    };
    const { error } = await supabaseAdmin.from("app_settings").upsert(
      { key: "checkin_notifications", value } as never,
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    return value;
  });
