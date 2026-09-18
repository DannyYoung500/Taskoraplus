import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function guard(userId: string) {
  const { assertOwner, admin } = await import("@/lib/owner-guard.server");
  await assertOwner(userId);
  return admin();
}
async function audit(adminId: string, action: string, previous: unknown, next: unknown, targetId?: string) {
  const { audit: writeAudit } = await import("@/lib/owner-guard.server");
  await writeAudit({ adminId, action, targetType: "advertise_economy", targetId, previous, next });
}
export const getAdvertiseEconomy = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const db = await guard(context.userId);
  const [{ data: settings, error: settingsError }, { data: services, error: servicesError }] = await Promise.all([
    (db as any).from("advertise_economy_settings").select("*").eq("id", true).maybeSingle(),
    (db as any).from("advertise_service_catalog").select("*").order("platform").order("service_name"),
  ]);
  if (settingsError) throw new Error(settingsError.message);
  if (servicesError) throw new Error(servicesError.message);
  let list = services ?? [];
  // Auto-seed catalog from code defaults when empty so Owner always sees platforms + prices
  if (!list.length) {
    try {
      const { SERVICES } = await import("@/lib/advertise-services");
      const rows: Record<string, unknown>[] = [];
      for (const [platform, items] of Object.entries(SERVICES as Record<string, any[]>)) {
        for (const s of items) {
          rows.push({
            service_id: s.id,
            platform,
            service_name: s.title,
            min_quantity: s.minQty ?? 1,
            max_quantity: s.maxQty ?? 10000,
            customer_unit_price: Number(s.fromUsd ?? 0.01),
            tasker_unit_reward: Number(s.taskerUsd ?? 0.007),
            taskora_unit_margin: Number(s.taskoraUsd ?? 0.003),
            active: true,
            pricing_model: "per_unit",
            proof_mode: platform === "telegram" ? "bot_admin_or_screenshot" : "screenshot_optional",
          });
        }
      }
      if (rows.length) {
        await (db as any).from("advertise_service_catalog").upsert(rows, { onConflict: "service_id" });
        const { data: seeded } = await (db as any)
          .from("advertise_service_catalog")
          .select("*")
          .order("platform")
          .order("service_name");
        list = seeded ?? rows;
      }
    } catch {
      /* catalog seed optional if table shape differs */
    }
  }
  return { settings, services: list };
});
export const saveAdvertiseEconomySettings = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { taskerSharePercent:number; marginPercent:number; youtubeWatchCustomerPerSecond:number; youtubeWatchTaskerPerSecond:number; youtubeWatchTaskoraPerSecond:number; youtubeWatchMinSeconds:number; youtubeWatchMaxSeconds:number; globalMinCampaignValueUsd:number; globalMaxCampaignValueUsd:number; reason?: string }) => d).handler(async ({ data, context }) => {
  const db = await guard(context.userId);
  const { data: prev } = await (db as any).from("advertise_economy_settings").select("*").eq("id", true).maybeSingle();
  const next = {
    id: true,
    default_tasker_share_percent: data.taskerSharePercent,
    default_taskora_margin_percent: data.marginPercent,
    youtube_watch_customer_per_second: data.youtubeWatchCustomerPerSecond,
    youtube_watch_tasker_per_second: data.youtubeWatchTaskerPerSecond,
    youtube_watch_taskora_per_second: data.youtubeWatchTaskoraPerSecond,
    youtube_watch_min_seconds: data.youtubeWatchMinSeconds,
    youtube_watch_max_seconds: data.youtubeWatchMaxSeconds,
    global_min_campaign_value_usd: data.globalMinCampaignValueUsd,
    global_max_campaign_value_usd: data.globalMaxCampaignValueUsd,
    updated_at: new Date().toISOString(),
  };
  const { data: saved, error } = await (db as any).from("advertise_economy_settings").upsert(next).select("*").single();
  if (error) throw new Error(error.message);
  await audit(context.userId, "advertise_economy.settings_update", prev, saved);
  return saved;
});
export const updateAdvertiseService = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { serviceId: string; customerUnitPrice: number; taskerUnitReward: number; taskoraUnitMargin: number; minQuantity?: number; maxQuantity?: number; active?: boolean; reason?: string }) => d).handler(async ({ data, context }) => {
  const db = await guard(context.userId);
  if (data.customerUnitPrice < 0 || data.taskerUnitReward < 0 || data.taskoraUnitMargin < 0) throw new Error("Prices cannot be negative.");
  if (data.taskerUnitReward + data.taskoraUnitMargin > data.customerUnitPrice + 0.0000001) throw new Error("Tasker + margin cannot exceed customer price.");
  const { data: prev } = await (db as any).from("advertise_service_catalog").select("*").eq("service_id", data.serviceId).maybeSingle();
  if (!prev) throw new Error("Service not found.");
  const floor = Number(prev.customer_unit_price ?? 0) * 0; // owner may lower; enforce non-negative only
  const { data: updated, error } = await (db as any).from("advertise_service_catalog").update({
    customer_unit_price: data.customerUnitPrice,
    tasker_unit_reward: data.taskerUnitReward,
    taskora_unit_margin: data.taskoraUnitMargin,
    min_quantity: data.minQuantity ?? prev.min_quantity,
    max_quantity: data.maxQuantity ?? prev.max_quantity,
    active: data.active ?? prev.active,
    updated_at: new Date().toISOString(),
  }).eq("service_id", data.serviceId).select("*").single();
  if (error) throw new Error(error.message);
  await audit(context.userId, "advertise_service.price_update", prev, updated, data.serviceId);
  return updated;
});
export const setAdvertiseCampaignStatus = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { id: string; status: string }) => d).handler(async ({ data, context }) => {
  const db = await guard(context.userId);
  const { data: campaign, error: readError } = await (db as any).from("campaigns").select("*").eq("id", data.id).maybeSingle();
  if (readError || !campaign) throw new Error(readError?.message ?? "Campaign not found.");
  const { data: updated, error } = await (db as any).from("campaigns").update({ status: data.status, updated_at: new Date().toISOString() }).eq("id", data.id).select("*").single();
  if (error) throw new Error(error.message);
  const active = data.status === "active";
  const taskStatus = active ? "active" : data.status === "paused" ? "paused" : data.status === "completed" ? "completed" : "cancelled";
  await (db as any).from("tasks").update({ is_active: active, status: taskStatus }).eq("campaign_id", data.id);
  await audit(context.userId, "advertise_campaign.status_update", campaign, updated, data.id);
  return updated;
});
