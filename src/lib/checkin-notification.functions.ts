import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertOwner } from "@/lib/owner-guard.server";

export type CheckinNotificationSettings = {
  enabled: boolean;
  morning_time: string;
  night_time: string;
  message: string;
};

const DEFAULTS: CheckinNotificationSettings = {
  enabled: true,
  morning_time: "09:00",
  night_time: "21:00",
  message: "📅 Check-in Reminder\n\n⏰ You haven't checked in today!\n🔥 Keep your streak going and earn more 🎯 Task Points.\n\n👇 Check in now to claim today's points.",
};

function validTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export const ownerGetCheckinNotificationSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", "checkin_notifications").maybeSingle();
    const value = ((data as any)?.value ?? {}) as Partial<CheckinNotificationSettings>;
    return {
      enabled: value.enabled !== false,
      morning_time: validTime(String(value.morning_time ?? "")) ? String(value.morning_time) : DEFAULTS.morning_time,
      night_time: validTime(String(value.night_time ?? "")) ? String(value.night_time) : DEFAULTS.night_time,
      message: String(value.message ?? DEFAULTS.message).slice(0, 3500),
    };
  });

export const ownerSetCheckinNotificationSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: CheckinNotificationSettings) => d)
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    if (!validTime(data.morning_time) || !validTime(data.night_time)) throw new Error("Use valid morning and night times.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const value = {
      enabled: Boolean(data.enabled),
      morning_time: data.morning_time,
      night_time: data.night_time,
      message: String(data.message || DEFAULTS.message).slice(0, 3500),
    };
    const { error } = await (supabaseAdmin as any).from("app_settings").upsert(
      { key: "checkin_notifications", value },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    return value;
  });
