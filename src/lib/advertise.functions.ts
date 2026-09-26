import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateAdvertiseOrder } from "@/lib/advertise-economy";

export const listAdvertiseServices=createServerFn({method:"GET"}).handler(async()=>{
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  const {data,error}=await supabaseAdmin.from("advertise_service_catalog").select("*").eq("active",true).order("platform").order("service_name");
  if(error) throw new Error(error.message); return data??[];
});

export const createAdvertiseCampaign=createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
.inputValidator((d:{serviceId:string;title?:string;link:string;quantity:number;watchSeconds?:number;videoSource?:string;videoDurationSeconds?:number})=>d)
.handler(async({data,context})=>{
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  const [{data:service,error:serviceError},{data:economy,error:economyError}]=await Promise.all([
    supabaseAdmin.from("advertise_service_catalog").select("*").eq("service_id",data.serviceId).eq("active",true).maybeSingle(),
    supabaseAdmin.from("advertise_economy_settings").select("*").eq("id",true).maybeSingle()
  ]);
  if(serviceError) throw new Error(serviceError.message);
  if(economyError) throw new Error(economyError.message);
  if(!service) throw new Error("Advertise service is unavailable.");

  const quantity=Math.floor(Number(data.quantity));
  if(quantity<Number(service.min_quantity)||quantity>Number(service.max_quantity)) throw new Error(`Quantity must be between ${service.min_quantity.toLocaleString()} and ${service.max_quantity.toLocaleString()}.`);
  const minWatch=Number(economy?.youtube_watch_min_seconds??1);
  const maxWatch=Number(economy?.youtube_watch_max_seconds??7200);
  const watchSeconds=service.pricing_model==="watch_second"?Math.floor(Number(data.watchSeconds??0)):0;
  const detectedVideoDuration=service.pricing_model==="watch_second"?Math.floor(Number(data.videoDurationSeconds??0)):0;
  if(service.pricing_model==="watch_second"&&detectedVideoDuration>0&&watchSeconds>detectedVideoDuration) throw new Error(`Watch duration cannot exceed the detected YouTube video length (${Math.floor(detectedVideoDuration/60)}m ${detectedVideoDuration%60}s).`);
  if(service.pricing_model==="watch_second"&&(watchSeconds<minWatch||watchSeconds>maxWatch)) throw new Error(`Watch duration must be between ${minWatch} and ${maxWatch} seconds.`);
  const target=String(data.link||"").trim();
  if(!/^https?:\/\//i.test(target)) throw new Error("Enter a valid video or target URL.");

  const unitService={
    serviceId:service.service_id,platform:service.platform,serviceName:service.service_name,taskType:service.task_type,
    minQuantity:Number(service.min_quantity),maxQuantity:Number(service.max_quantity),
    customerUnitPrice:Number(service.customer_unit_price),taskerUnitReward:Number(service.tasker_unit_reward),
    taskoraUnitMargin:Number(service.taskora_unit_margin),pricingModel:service.pricing_model
  } as const;
  const pricing=calculateAdvertiseOrder(unitService,quantity,watchSeconds);
  const globalMin=Number(economy?.global_min_campaign_value_usd??0);
  const globalMax=Number(economy?.global_max_campaign_value_usd??0);
  if(globalMin>0&&pricing.customerTotal<globalMin) throw new Error(`Campaign value must be at least $${globalMin.toFixed(2)}.`);
  if(globalMax>0&&pricing.customerTotal>globalMax) throw new Error(`Campaign value cannot exceed $${globalMax.toFixed(2)}.`);

  const perTaskReward=service.pricing_model==="watch_second"
    ? Number((Number(service.tasker_unit_reward)*watchSeconds).toFixed(8))
    : Number(service.tasker_unit_reward);
  const perTaskCustomer=service.pricing_model==="watch_second"
    ? Number((Number(service.customer_unit_price)*watchSeconds).toFixed(8))
    : Number(service.customer_unit_price);
  const verificationMethods=service.pricing_model==="watch_second"
    ? ["automatic"]
    : service.platform==="telegram"||service.platform==="discord"
      ? ["automatic","screenshot"]
      : ["screenshot"];
  const verificationMode=verificationMethods[0];
  const campaignTitle=data.title?.trim()||service.service_name;
  const taskTitle=service.pricing_model==="watch_second"?"Watch video and earn":campaignTitle;
  const instructions=service.pricing_model==="watch_second"
    ? `Watch the video for ${watchSeconds} seconds. Taskora verifies the qualifying playback automatically.`
    : `Complete the ${service.service_name} action. Verification: ${verificationMode}.`;

  const {data:campaign,error:campaignError}=await supabaseAdmin.from("campaigns").insert({
    advertiser_user_id:context.userId,advertiser_id:context.userId,platform:service.platform,task_type:service.task_type,
    title:campaignTitle,instructions,target_url:target,reward:perTaskReward,slots:quantity,remaining_slots:quantity,
    budget:pricing.customerTotal,amount_spent:0,status:"draft"
  } as never).select("*").single();
  if(campaignError||!campaign) throw new Error(campaignError?.message??"Could not create campaign.");

  const taskType=service.pricing_model==="watch_second"?"video_watch":service.task_type;
  const taskMetadata={
    pricing_snapshot:{
      customer_unit_price:Number(service.customer_unit_price),tasker_unit_reward:Number(service.tasker_unit_reward),
      taskora_unit_margin:Number(service.taskora_unit_margin),customer_per_completion:perTaskCustomer,
      user_reward_per_completion:perTaskReward,taskora_fee_per_completion:Number((perTaskCustomer-perTaskReward).toFixed(8)),
      split:{worker_percent:70,taskora_percent:30},pricing_model:service.pricing_model
    },
    watch_seconds:service.pricing_model==="watch_second"?watchSeconds:null,
    video_source:service.pricing_model==="watch_second"?(data.videoSource||"url"):null,
    verification_methods:verificationMethods,
    screenshot_fallback:service.platform==="telegram"||service.platform==="discord",
    locked_reward:true
  };
  const {data:task,error:taskError}=await supabaseAdmin.from("tasks").insert({
    platform:service.platform,title:taskTitle,advertiser:"TASKORA Advertiser",reward:perTaskReward,
    seconds:service.pricing_model==="watch_second"?watchSeconds:30,slots_left:quantity,steps:service.pricing_model==="watch_second"?[`Watch for ${Math.floor(watchSeconds/60)}m ${watchSeconds%60}s`,"Wait for automatic verification"]:service.default_steps??[`Complete: ${service.service_name}`],
    proof:verificationMode,link:target,is_active:false,status:"draft",task_type:taskType,target,slots_total:quantity,budget:pricing.customerTotal,
    campaign_id:campaign.id,created_by:context.userId,instructions,requires_review:verificationMode==="screenshot",
    task_metadata:taskMetadata,warning_text:null,description:null,featured:false
  } as never).select("*").single();
  if(taskError||!task){await supabaseAdmin.from("campaigns").delete().eq("id",campaign.id);throw new Error(taskError?.message??"Could not create campaign task.");}
  return {campaign,task,pricing:{...pricing,watchSeconds,perTaskReward,perTaskCustomer,verificationMethods},status:"draft" as const};
});
