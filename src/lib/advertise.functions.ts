import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateAdvertiseOrder } from "@/lib/advertise-economy";

export const listAdvertiseServices = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("advertise_service_catalog").select("*").eq("active", true).order("platform").order("service_name");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const createAdvertiseCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { serviceId:string; title?:string; link:string; quantity:number; watchSeconds?:number }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: service, error: serviceError }, { data: economy, error: economyError }] = await Promise.all([
      supabaseAdmin.from("advertise_service_catalog").select("*").eq("service_id", data.serviceId).eq("active", true).maybeSingle(),
      supabaseAdmin.from("advertise_economy_settings").select("*").eq("id", true).maybeSingle(),
    ]);
    if (serviceError) throw new Error(serviceError.message);
    if (economyError) throw new Error(economyError.message);
    if (!service) throw new Error("Advertise service is unavailable.");

    const quantity = Math.floor(Number(data.quantity));
    if (quantity < Number(service.min_quantity) || quantity > Number(service.max_quantity)) throw new Error(`Quantity must be between ${service.min_quantity.toLocaleString()} and ${service.max_quantity.toLocaleString()}.`);
    const minWatch = Number(economy?.youtube_watch_min_seconds ?? 1);
    const maxWatch = Number(economy?.youtube_watch_max_seconds ?? 3600);
    const watchSeconds = service.pricing_model === "watch_second" ? Math.floor(Number(data.watchSeconds ?? 0)) : 0;
    if (service.pricing_model === "watch_second" && (watchSeconds < minWatch || watchSeconds > maxWatch)) throw new Error(`Watch duration must be between ${minWatch} and ${maxWatch} seconds.`);
    if (!/^https?:\/\//i.test(data.link.trim())) throw new Error("Enter a valid target URL.");

    const unitService = { serviceId:service.service_id, platform:service.platform, serviceName:service.service_name, taskType:service.task_type, minQuantity:Number(service.min_quantity), maxQuantity:Number(service.max_quantity), customerUnitPrice:Number(service.customer_unit_price), taskerUnitReward:Number(service.tasker_unit_reward), taskoraUnitMargin:Number(service.taskora_unit_margin), pricingModel:service.pricing_model } as const;
    const pricing = calculateAdvertiseOrder(unitService, quantity, watchSeconds);
    const globalMin = Number(economy?.global_min_campaign_value_usd ?? 0);
    const globalMax = Number(economy?.global_max_campaign_value_usd ?? 0);
    if (globalMin > 0 && pricing.customerTotal < globalMin) throw new Error(`Campaign value must be at least $${globalMin.toFixed(2)}.`);
    if (globalMax > 0 && pricing.customerTotal > globalMax) throw new Error(`Campaign value cannot exceed $${globalMax.toFixed(2)}.`);
    const perTaskReward = service.pricing_model === "watch_second" ? Number((Number(service.tasker_unit_reward) * watchSeconds).toFixed(8)) : Number(service.tasker_unit_reward);
    const budget = pricing.customerTotal;

    const { data: campaign, error: campaignError } = await supabaseAdmin.from("campaigns").insert({ name:data.title?.trim() || `${service.service_name} campaign`, advertiser_id:context.userId, advertiser_name:"TASKORA Advertiser", status:"draft", budget, spent:0, slots:quantity, slots_left:quantity } as never).select("*").single();
    if (campaignError || !campaign) throw new Error(campaignError?.message ?? "Could not create campaign.");

    const taskType = service.pricing_model === "watch_second" ? "youtube_watch" : service.task_type;
    const steps = service.pricing_model === "watch_second" ? ["Open the YouTube video", `Watch for at least ${watchSeconds} seconds`, "Return and submit proof"] : ["Open the target link", `Complete: ${service.service_name}`, "Return and submit proof"];
    const { data: task, error: taskError } = await supabaseAdmin.from("tasks").insert({ platform:service.platform, title:data.title?.trim() || service.service_name, advertiser:"TASKORA Advertiser", reward:perTaskReward, slots_left:quantity, steps, proof:service.platform === "telegram" ? "auto" : "screenshot", link:data.link.trim(), is_active:false, status:"draft", task_type:taskType, target:data.link.trim(), slots_total:quantity, budget, campaign_id:campaign.id, created_by:context.userId, instructions:service.pricing_model === "watch_second" ? `Verified watch duration: ${watchSeconds}s` : null } as never).select("*").single();
    if (taskError || !task) { await supabaseAdmin.from("campaigns").delete().eq("id",campaign.id); throw new Error(taskError?.message ?? "Could not create campaign task."); }
    return { campaign, task, pricing:{...pricing,watchSeconds,perTaskReward}, status:"draft" as const };
  });
