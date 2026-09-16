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
  return { settings, services: services ?? [] };
});
export const saveAdvertiseEconomySettings = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: { taskerSharePercent:number; marginPercent:number; youtubeWatchCustomerPerSecond:number; youtubeWatchTaskerPerSecond:number; youtubeWatchTaskoraPerSecond:number; youtubeWatchMinSeconds:number; youtubeWatchMaxSeconds:number; globalMinCampaignValueUsd:number; globalMaxCampaignValueUsd:number; reason:string }) => d).handler(async ({ data, context }) => {
  if (!data.reason.trim()) throw new Error("Reason is required for economy changes.");
  const db = await guard(context.userId);
  const { data: previous } = await (db as any).from("advertise_economy_settings").select("*").eq("id", true).maybeSingle();
  const tasker = Math.max(0, Math.min(100, Number(data.taskerSharePercent)));
  const margin = Math.max(0, Math.min(100, Number(data.marginPercent)));
  if (Math.abs(tasker + margin - 100) > .001) throw new Error("Tasker share and TASKORA margin must total 100%.");
  const payload = { id:true, default_tasker_share_percent:tasker, default_taskora_margin_percent:margin, youtube_watch_customer_per_second:Math.max(0,Number(data.youtubeWatchCustomerPerSecond)), youtube_watch_tasker_per_second:Math.max(0,Number(data.youtubeWatchTaskerPerSecond)), youtube_watch_taskora_per_second:Math.max(0,Number(data.youtubeWatchTaskoraPerSecond)), youtube_watch_min_seconds:Math.max(1,Math.floor(Number(data.youtubeWatchMinSeconds))), youtube_watch_max_seconds:Math.max(1,Math.floor(Number(data.youtubeWatchMaxSeconds))), global_min_campaign_value_usd:Math.max(0,Number(data.globalMinCampaignValueUsd)), global_max_campaign_value_usd:Math.max(0,Number(data.globalMaxCampaignValueUsd)), updated_by:context.userId, updated_at:new Date().toISOString(), reason:data.reason.trim() };
  if (payload.youtube_watch_max_seconds < payload.youtube_watch_min_seconds) throw new Error("YouTube maximum watch duration cannot be below the minimum.");
  if (payload.global_max_campaign_value_usd > 0 && payload.global_max_campaign_value_usd < payload.global_min_campaign_value_usd) throw new Error("Maximum campaign value cannot be below the minimum.");
  const { data:saved, error } = await (db as any).from("advertise_economy_settings").upsert(payload,{onConflict:"id"}).select("*").single();
  if (error) throw new Error(error.message);
  await audit(context.userId,"advertise_economy.settings_update",previous,saved);
  return saved;
});
export const updateAdvertiseService = createServerFn({ method:"POST" }).middleware([requireSupabaseAuth]).inputValidator((d:{serviceId:string;customerUnitPrice:number;taskerUnitReward:number;taskoraUnitMargin:number;minQuantity:number;maxQuantity:number;active:boolean;reason:string})=>d).handler(async({data,context})=>{
  if(!data.reason.trim()) throw new Error("Reason is required for pricing changes.");
  const db=await guard(context.userId);
  const {data:previous}=await(db as any).from("advertise_service_catalog").select("*").eq("service_id",data.serviceId).maybeSingle();
  if(!previous) throw new Error("Advertise service not found.");
  const customer=Math.max(0,Number(data.customerUnitPrice)),tasker=Math.max(0,Number(data.taskerUnitReward)),margin=Math.max(0,Number(data.taskoraUnitMargin));
  if(Math.abs(customer-tasker-margin)>.00000001) throw new Error("Customer price must equal tasker reward plus TASKORA margin.");
  const min=Math.max(1,Math.floor(Number(data.minQuantity))),max=Math.max(min,Math.floor(Number(data.maxQuantity)));
  const {data:saved,error}=await(db as any).from("advertise_service_catalog").update({customer_unit_price:customer,tasker_unit_reward:tasker,taskora_unit_margin:margin,min_quantity:min,max_quantity:max,active:Boolean(data.active),updated_by:context.userId,updated_at:new Date().toISOString()}).eq("service_id",data.serviceId).select("*").single();
  if(error) throw new Error(error.message);
  await audit(context.userId,"advertise_economy.service_update",previous,saved,data.serviceId);
  return saved;
});
export const setAdvertiseCampaignStatus = createServerFn({ method:"POST" }).middleware([requireSupabaseAuth]).inputValidator((d:{id:string;status:"active"|"paused"|"completed"|"cancelled"})=>d).handler(async({data,context})=>{
  const db=await guard(context.userId);
  const {data:campaign,error:readError}=await(db as any).from("campaigns").select("*").eq("id",data.id).maybeSingle();
  if(readError||!campaign) throw new Error(readError?.message??"Campaign not found.");
  const {data:updated,error}=await(db as any).from("campaigns").update({status:data.status,updated_at:new Date().toISOString()}).eq("id",data.id).select("*").single();
  if(error) throw new Error(error.message);
  const active=data.status==="active";
  const taskStatus=active?"active":data.status==="paused"?"paused":data.status==="completed"?"completed":"cancelled";
  await(db as any).from("tasks").update({is_active:active,status:taskStatus}).eq("campaign_id",data.id);
  await audit(context.userId,"advertise_campaign.status_update",campaign,updated,data.id);
  return updated;
});
