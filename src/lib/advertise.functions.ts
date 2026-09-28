import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateAdvertiseOrder } from "@/lib/advertise-economy";

export const listAdvertiseServices=createServerFn({method:"GET"}).handler(async()=>{
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  const {data,error}=await supabaseAdmin.from("advertise_service_catalog").select("*").eq("active",true).order("platform").order("service_name");
  if(error) throw new Error(error.message); return data??[];
});

export const createAdvertiseCampaign=createServerFn({method:"POST"}).middleware([requireSupabaseAuth])
.inputValidator((d:{serviceId:string;title?:string;link:string;quantity:number;watchSeconds?:number;videoSource?:string;videoDurationSeconds?:number;targetCountryCode?:string;targetCountryName?:string;allowOtherCountriesIfUnavailable?:boolean;description?:string;instructions?:string;warningText?:string;proofRequirements?:string[];difficulty?:"easy"|"medium"|"hard";screenshotsRequired?:number;featured?:boolean;verificationMode?:"automatic"|"screenshot"})=>d)
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
  const maxWatch=Number(economy?.youtube_watch_max_seconds??10800);
  const watchSeconds=service.pricing_model==="watch_second"?Math.floor(Number(data.watchSeconds??0)):0;
  const detectedVideoDuration=service.pricing_model==="watch_second"?Math.floor(Number(data.videoDurationSeconds??0)):0;
  if(service.pricing_model==="watch_second"&&detectedVideoDuration>0&&watchSeconds>detectedVideoDuration) throw new Error(`Watch duration cannot exceed the detected YouTube video length (${Math.floor(detectedVideoDuration/60)}m ${detectedVideoDuration%60}s).`);
  if(service.pricing_model==="watch_second"&&(watchSeconds<minWatch||watchSeconds>maxWatch)) throw new Error(`Watch duration must be between ${minWatch} and ${maxWatch} seconds.`);

  const target=String(data.link||"").trim();
  const targetCountryCode=String(data.targetCountryCode||"").trim().toUpperCase();
  const targetCountryName=String(data.targetCountryName||"").trim()||null;
  const allowOtherCountriesIfUnavailable=data.allowOtherCountriesIfUnavailable!==false;
  if(targetCountryCode&&!/^[A-Z]{2}$/.test(targetCountryCode)) throw new Error("Choose a valid country.");
  if(!/^https?:\/\//i.test(target)) throw new Error("Enter a valid video or target URL.");

  const unitService={
    serviceId:service.service_id,platform:service.platform,serviceName:service.service_name,taskType:service.task_type,
    minQuantity:Number(service.min_quantity),maxQuantity:Number(service.max_quantity),
    customerUnitPrice:Number(service.customer_unit_price),taskerUnitReward:Number(service.tasker_unit_reward),
    taskoraUnitMargin:Number(service.taskora_unit_margin),pricingModel:service.pricing_model
  } as const;
  const pricing=calculateAdvertiseOrder(unitService,quantity,watchSeconds);

  const featureFee=Boolean(data.featured)?5:0;
  const customerTotalWithFeature=Number((pricing.customerTotal+featureFee).toFixed(8));
  const globalMin=Number(economy?.global_min_campaign_value_usd??0);
  const globalMax=Number(economy?.global_max_campaign_value_usd??0);
  if(globalMin>0&&customerTotalWithFeature<globalMin) throw new Error(`Campaign value must be at least $${globalMin.toFixed(2)}.`);
  if(globalMax>0&&customerTotalWithFeature>globalMax) throw new Error(`Campaign value cannot exceed $${globalMax.toFixed(2)}.`);

  const perTaskReward=service.pricing_model==="watch_second"
    ? Number((Number(service.tasker_unit_reward)*watchSeconds).toFixed(8))
    : Number(service.tasker_unit_reward);
  const perTaskCustomer=service.pricing_model==="watch_second"
    ? Number((Number(service.customer_unit_price)*watchSeconds).toFixed(8))
    : Number(service.customer_unit_price);

  const isCommunityService=service.platform==="telegram"||service.platform==="discord";
  const verificationMode=service.pricing_model==="watch_second"
    ? "automatic"
    : isCommunityService
      ? (data.verificationMode==="screenshot"?"screenshot":"automatic")
      : "screenshot";
  const verificationMethods=[verificationMode];

  const proofRequirements=Array.isArray(data.proofRequirements)
    ? data.proofRequirements.filter((v)=>["screenshot","text","link","watch_completion"].includes(String(v)))
    : service.pricing_model==="watch_second" ? ["watch_completion"] : verificationMode==="automatic" ? ["automatic"] : ["screenshot"];
  const difficulty=data.difficulty==="hard"?"hard":data.difficulty==="medium"?"medium":"easy";
  const screenshotsRequired=Math.max(0,Math.min(3,Math.floor(Number(data.screenshotsRequired??(verificationMode==="screenshot"?1:0)))));
  const featured=Boolean(data.featured);
  const campaignTitle=String(data.title||"").trim()||service.service_name;
  const taskTitle=service.pricing_model==="watch_second"?"Watch video and earn":campaignTitle;
  const description=String(data.description||service.service_name).trim();
  const customInstructions=String(data.instructions||"").trim();
  const warningText=String(data.warningText||"").trim();
  const instructionLines=customInstructions.split(/\r?\n/).map((s)=>s.trim()).filter(Boolean);
  const steps=service.pricing_model==="watch_second"
    ? [`Watch for ${Math.floor(watchSeconds/60)}m ${watchSeconds%60}s`,"Wait for automatic verification"]
    : instructionLines.length?instructionLines:[`Complete: ${service.service_name}`,"Return to TASKORA and submit proof"];
  const taskInstructions=service.pricing_model==="watch_second"
    ? `Watch the video for ${watchSeconds} seconds. Taskora verifies the qualifying playback automatically.`
    : customInstructions||`Complete the ${service.service_name} action and submit the required proof.`;

  const campaignId=crypto.randomUUID();
  const {data:campaign,error:campaignError}=await supabaseAdmin.from("campaigns").insert({
    id:campaignId,
    advertiser_user_id:context.userId,advertiser_id:context.userId,platform:service.platform,task_type:service.task_type,
    title:campaignTitle,instructions:taskInstructions,target_url:target,reward:perTaskReward,slots:quantity,remaining_slots:quantity,
    budget:customerTotalWithFeature,amount_spent:0,status:"draft",
    target_country_code:targetCountryCode||null,target_country_name:targetCountryName,
    allow_other_countries_if_unavailable:allowOtherCountriesIfUnavailable,
    funding_status:"unfunded",funding_reserved:0,funding_spent:0
  } as never).select("*").single();
  if(campaignError||!campaign) throw new Error(campaignError?.message??"Could not create campaign.");

  const {error:fundingError}=await supabaseAdmin.rpc("reserve_campaign_budget",{p_advertiser_id:context.userId,p_campaign_id:campaign.id,p_amount:customerTotalWithFeature});
  if(fundingError){ await supabaseAdmin.from("campaigns").delete().eq("id",campaign.id); throw new Error(fundingError.message); }

  const taskType=service.pricing_model==="watch_second"?"video_watch":service.task_type;
  const proof=verificationMode==="screenshot"?"screenshot":verificationMode==="automatic"?"auto":"username";
  const requiresReview=verificationMode==="screenshot";
  const taskMetadata={
    pricing_snapshot:{
      customer_unit_price:Number(service.customer_unit_price),tasker_unit_reward:Number(service.tasker_unit_reward),
      taskora_unit_margin:Number(service.taskora_unit_margin),customer_per_completion:perTaskCustomer,
      user_reward_per_completion:perTaskReward,taskora_fee_per_completion:Number((perTaskCustomer-perTaskReward).toFixed(8)),
      split:{worker_percent:70,taskora_percent:30},pricing_model:service.pricing_model,feature_fee:featureFee
    },
    watch_seconds:service.pricing_model==="watch_second"?watchSeconds:null,
    video_source:service.pricing_model==="watch_second"?(data.videoSource||"url"):null,
    verification_methods:verificationMethods,screenshot_fallback:false,locked_reward:true,
    creation_form:{description,instructions:customInstructions,warning_text:warningText,proof_requirements:proofRequirements,difficulty,screenshots_required:screenshotsRequired,featured}
  };

  const {data:task,error:taskError}=await supabaseAdmin.from("tasks").insert({
    platform:service.platform,title:taskTitle,advertiser:"TASKORA Advertiser",reward:perTaskReward,
    seconds:service.pricing_model==="watch_second"?watchSeconds:30,slots_left:quantity,steps,proof,link:target,
    is_active:false,status:"draft",task_type:taskType,target,slots_total:quantity,budget:customerTotalWithFeature,
    campaign_id:campaign.id,created_by:context.userId,instructions:taskInstructions,description,
    warning_text:warningText,requires_review:requiresReview,difficulty,screenshots_required:screenshotsRequired,
    proof_requirements:proofRequirements,featured,task_metadata:taskMetadata,
    target_country_code:targetCountryCode||null,target_country_name:targetCountryName,
    allow_other_countries_if_unavailable:allowOtherCountriesIfUnavailable
  } as never).select("*").single();
  if(taskError||!task){
    await supabaseAdmin.from("campaigns").delete().eq("id",campaign.id);
    throw new Error(taskError?.message??"Could not create campaign task.");
  }

  const evidenceRequirements={
    campaign_id:campaign.id,task_id:task.id,service_id:service.service_id,platform:service.platform,
    verification_methods:verificationMethods,primary_method:verificationMode,
    screenshot_required:verificationMode==="screenshot",automatic_required:verificationMode==="automatic",
    reward_locked_until_verified:true,owner_review_required:requiresReview,
    evidence_fields:["submission_id","proof_hash","proof_url","proof_text","submitted_at","reviewed_at","reviewed_by"],
    watch_seconds:service.pricing_model==="watch_second"?watchSeconds:null
  };
  const {error:requirementError}=await supabaseAdmin.from("campaign_verification_requirements").insert({
    campaign_id:campaign.id,task_id:task.id,verification_mode:verificationMode,requirements:evidenceRequirements,status:"pending"
  });
  if(requirementError){
    await supabaseAdmin.from("tasks").delete().eq("id",task.id);
    await supabaseAdmin.from("campaigns").delete().eq("id",campaign.id);
    throw new Error(requirementError.message);
  }

  const {error:advertiserCaseError}=await supabaseAdmin.from("verification_cases").upsert({
    subject_type:"advertiser",subject_id:context.userId,verification_type:"advertiser_campaign_access",status:"pending",
    evidence:{source:"advertise_campaign_creation",latest_campaign_id:campaign.id,platform:service.platform,service_id:service.service_id,verification_methods:verificationMethods},
    updated_at:new Date().toISOString()
  },{onConflict:"subject_type,subject_id,verification_type"});
  if(advertiserCaseError){
    await supabaseAdmin.from("tasks").delete().eq("id",task.id);
    await supabaseAdmin.from("campaigns").delete().eq("id",campaign.id);
    throw new Error(advertiserCaseError.message);
  }

  const {error:taskCaseError}=await supabaseAdmin.from("verification_cases").insert({
    subject_type:"task",subject_id:task.id,verification_type:"campaign_completion_evidence",status:"pending",evidence:evidenceRequirements
  });
  if(taskCaseError){
    await supabaseAdmin.from("tasks").delete().eq("id",task.id);
    await supabaseAdmin.from("campaigns").delete().eq("id",campaign.id);
    throw new Error(taskCaseError.message);
  }

  return {campaign,task,pricing:{...pricing,customerTotal:customerTotalWithFeature,featureFee,watchSeconds,perTaskReward,perTaskCustomer,verificationMethods},status:"draft" as const};
});
