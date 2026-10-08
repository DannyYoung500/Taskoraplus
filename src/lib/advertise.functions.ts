import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { calculateAdvertiseOrder } from "@/lib/advertise-economy";
import {
  RULES,
  assertPlatformUrl,
  hoursSince,
  normalizeTargetUrl,
} from "@/lib/platform-rules";
import { isOwnerTelegramId } from "@/lib/owner";

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

  let quantity=Math.floor(Number(data.quantity));
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
  assertPlatformUrl(String(service.platform), target);

  const normalizedTarget = normalizeTargetUrl(target);

  try {
    const { data: sameLinkRows } = await supabaseAdmin
      .from("campaigns")
      .select("id, target_url, status")
      .in("status", ["draft", "active", "pending", "funded"])
      .limit(200);
    const sameCount = (sameLinkRows ?? []).filter(
      (r: { target_url?: string }) =>
        normalizeTargetUrl(String(r.target_url || "")) === normalizedTarget,
    ).length;
    if (sameCount >= RULES.maxActiveCampaignsPerTargetUrl) {
      throw new Error(
        `This link already has ${sameCount} active campaigns (max ${RULES.maxActiveCampaignsPerTargetUrl}).`,
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("already has")) throw e;
  }

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: campaigns24h } = await supabaseAdmin
    .from("campaigns")
    .select("id", { count: "exact", head: true })
    .eq("advertiser_user_id", context.userId)
    .gte("created_at", since24h);
  if ((campaigns24h ?? 0) >= RULES.maxCampaignsPerAdvertiser24h) {
    throw new Error(
      `You can create at most ${RULES.maxCampaignsPerAdvertiser24h} campaigns per 24 hours.`,
    );
  }

  let advertiserAgeHours = 9999;
  try {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("created_at")
      .eq("id", context.userId)
      .maybeSingle();
    advertiserAgeHours = hoursSince(profile?.created_at);
  } catch {}
  const underTrustHold = advertiserAgeHours < RULES.advertiserTrustHoldHours;

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

  if (underTrustHold) {
    if (quantity > RULES.advertiserTrustMaxQty) {
      throw new Error(`New advertisers (first ${RULES.advertiserTrustHoldHours}h) are limited to ${RULES.advertiserTrustMaxQty.toLocaleString()} units per campaign.`);
    }
    if (customerTotalWithFeature > RULES.advertiserTrustMaxCampaignUsd) {
      throw new Error(`New advertisers are limited to $${RULES.advertiserTrustMaxCampaignUsd} per campaign until trust unlocks.`);
    }
  }

  const perTaskReward=service.pricing_model==="watch_second"
    ? Number((Number(service.tasker_unit_reward)*watchSeconds).toFixed(8))
    : Number(service.tasker_unit_reward);
  const perTaskCustomer=service.pricing_model==="watch_second"
    ? Number((Number(service.customer_unit_price)*watchSeconds).toFixed(8))
    : Number(service.customer_unit_price);

  const automaticSupported =
    service.pricing_model === "watch_second" ||
    ((service.platform === "telegram" || service.platform === "discord") && service.task_type === "join");
  if (data.verificationMode === "automatic" && !automaticSupported && service.pricing_model !== "watch_second") {
    throw new Error("Automatic verification is only available for supported Watch, Telegram Join, and Discord Join tasks. Choose Screenshot verification for this campaign.");
  }
  const verificationMode=service.pricing_model==="watch_second"
    ? "automatic"
    : data.verificationMode==="automatic"
      ? "automatic"
      : "screenshot";
  const verificationMethods=[verificationMode];

  const taskType = String(service.task_type || "");
  const followLikeTypes = new Set(["follow", "like", "subscribe", "repost"]);
  const defaultShots =
    verificationMode === "screenshot"
      ? followLikeTypes.has(taskType)
        ? RULES.minScreenshotsFollowLike
        : 1
      : 0;

  let proofRequirements=Array.isArray(data.proofRequirements)
    ? data.proofRequirements.filter((v)=>["screenshot","link","watch_completion","automatic"].includes(String(v)))
    : service.pricing_model==="watch_second" ? ["watch_completion"] : verificationMode==="automatic" ? ["automatic"] : ["screenshot"];
  proofRequirements = proofRequirements.filter((v) => v !== "text" && v !== "comment");
  if (verificationMode === "screenshot" && !proofRequirements.includes("screenshot") && !proofRequirements.includes("automatic")) {
    proofRequirements = ["screenshot", ...proofRequirements];
  }
  const difficulty=data.difficulty==="hard"?"hard":data.difficulty==="medium"?"medium":"easy";
  const screenshotsRequired=Math.max(
    verificationMode === "screenshot" ? defaultShots : 0,
    Math.min(3, Math.floor(Number(data.screenshotsRequired ?? defaultShots))),
  );
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

  // Owner posts free — no wallet debit, no budget reserve
  let ownerFree = false;
  try {
    const { data: ownerProfile } = await supabaseAdmin
      .from("profiles")
      .select("telegram_id")
      .eq("id", context.userId)
      .maybeSingle();
    ownerFree = isOwnerTelegramId(ownerProfile?.telegram_id ?? null);
  } catch {}
  if (ownerFree) {
    await supabaseAdmin.from("campaigns").update({
      funding_status: "funded",
      funding_reserved: 0,
      status: "active",
      budget: customerTotalWithFeature,
    } as never).eq("id", campaign.id);
  } else {
    const {error:fundingError}=await supabaseAdmin.rpc("reserve_campaign_budget",{p_advertiser_id:context.userId,p_campaign_id:campaign.id,p_amount:customerTotalWithFeature});
    if(fundingError){ await supabaseAdmin.rpc("release_campaign_budget",{p_campaign_id:campaign.id});
      await supabaseAdmin.from("campaigns").delete().eq("id",campaign.id); throw new Error(fundingError.message); }
  }

  const taskTypeDb=service.pricing_model==="watch_second"?"video_watch":service.task_type;
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
    creation_form:{description,instructions:customInstructions,warning_text:warningText,proof_requirements:proofRequirements,difficulty,screenshots_required:screenshotsRequired,featured},
    owner_free_post: ownerFree,
  };

  const {data:task,error:taskError}=await supabaseAdmin.from("tasks").insert({
    platform:service.platform,title:taskTitle,advertiser: ownerFree ? "TASKORA Owner" : "TASKORA Advertiser",reward:perTaskReward,
    seconds:service.pricing_model==="watch_second"?watchSeconds:30,slots_left:quantity,steps,proof,link:target,
    is_active: ownerFree, status: ownerFree ? "active" : "draft",task_type:taskTypeDb,target,slots_total:quantity,budget:customerTotalWithFeature,
    campaign_id:campaign.id,created_by:context.userId,instructions:taskInstructions,description,
    warning_text:warningText,requires_review:requiresReview,difficulty,screenshots_required:screenshotsRequired,
    proof_requirements:proofRequirements,featured,task_metadata:taskMetadata,
    target_country_code:targetCountryCode||null,target_country_name:targetCountryName,
    allow_other_countries_if_unavailable:allowOtherCountriesIfUnavailable
  } as never).select("*").single();
  if(taskError||!task){
    if (!ownerFree) await supabaseAdmin.rpc("release_campaign_budget",{p_campaign_id:campaign.id});
    await supabaseAdmin.from("campaigns").delete().eq("id",campaign.id);
    throw new Error(taskError?.message??"Could not create campaign task.");
  }

  const evidenceRequirements={
    campaign_id:campaign.id,task_id:task.id,service_id:service.service_id,platform:service.platform,
    verification_methods:verificationMethods,primary_method:verificationMode,
    screenshot_required:verificationMode==="screenshot",automatic_required:verificationMode==="automatic",
    reward_locked_until_verified:true,owner_review_required:requiresReview,
    evidence_fields:["submission_id","proof_url","proof_hash","submitted_at","reviewed_at","reviewed_by"],
    watch_seconds:service.pricing_model==="watch_second"?watchSeconds:null
  };
  const {error:requirementError}=await supabaseAdmin.from("campaign_verification_requirements").insert({
    campaign_id:campaign.id,task_id:task.id,verification_mode:verificationMode,requirements:evidenceRequirements,status:"pending"
  });
  if(requirementError){
    await supabaseAdmin.from("tasks").delete().eq("id",task.id);
    if (!ownerFree) await supabaseAdmin.rpc("release_campaign_budget",{p_campaign_id:campaign.id});
    await supabaseAdmin.from("campaigns").delete().eq("id",campaign.id);
    throw new Error(requirementError.message);
  }

  const {error:advertiserCaseError}=await supabaseAdmin.from("verification_cases").upsert({
    subject_type:"advertiser",subject_id:context.userId,verification_type:"advertiser_campaign_access",status:"pending",
    evidence:{source:"advertise_campaign_creation",latest_campaign_id:campaign.id,platform:service.platform,service_id:service.service_id,verification_methods:verificationMethods,owner_free:ownerFree},
    updated_at:new Date().toISOString()
  },{onConflict:"subject_type,subject_id,verification_type"});
  if(advertiserCaseError){
    await supabaseAdmin.from("tasks").delete().eq("id",task.id);
    if (!ownerFree) await supabaseAdmin.rpc("release_campaign_budget",{p_campaign_id:campaign.id});
    await supabaseAdmin.from("campaigns").delete().eq("id",campaign.id);
    throw new Error(advertiserCaseError.message);
  }

  const {error:taskCaseError}=await supabaseAdmin.from("verification_cases").insert({
    subject_type:"task",subject_id:task.id,verification_type:"campaign_completion_evidence",status:"pending",evidence:evidenceRequirements
  });
  if(taskCaseError){
    await supabaseAdmin.from("tasks").delete().eq("id",task.id);
    if (!ownerFree) await supabaseAdmin.rpc("release_campaign_budget",{p_campaign_id:campaign.id});
    await supabaseAdmin.from("campaigns").delete().eq("id",campaign.id);
    throw new Error(taskCaseError.message);
  }

  return {campaign,task,pricing:{...pricing,customerTotal:customerTotalWithFeature,featureFee,watchSeconds,perTaskReward,perTaskCustomer,verificationMethods},status:(ownerFree?"active":"draft") as "active"|"draft",ownerFree};
});

export const listMyPosted = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tasks, error } = await supabaseAdmin
      .from("tasks")
      .select("id, title, platform, task_type, status, is_active, reward, slots_left, slots_total, link, created_at, proof, campaign_id")
      .eq("created_by", context.userId)
      .order("created_at", { ascending: false })
      .limit(80);
    if (error) throw new Error(error.message);

    const rows = tasks ?? [];
    const taskIds = rows.map((t) => t.id);
    const subCount = new Map<string, number>();
    if (taskIds.length) {
      const { data: subs } = await supabaseAdmin
        .from("submissions")
        .select("task_id, status")
        .in("task_id", taskIds);
      for (const s of subs ?? []) {
        const tid = String((s as { task_id: string }).task_id);
        const st = String((s as { status?: string }).status ?? "");
        if (st === "verified" || st === "approved" || st === "auto_approved" || st === "pending") {
          subCount.set(tid, (subCount.get(tid) ?? 0) + 1);
        }
      }
    }

    const mapped = rows.map((t) => {
      const type = String((t as { task_type?: string }).task_type ?? "").toLowerCase();
      const isVideo = type.includes("watch") || type.includes("video") || type === "view";
      return {
        id: t.id,
        title: String((t as { title?: string }).title ?? "Untitled"),
        platform: String((t as { platform?: string }).platform ?? ""),
        taskType: type,
        isVideo,
        status: String((t as { status?: string }).status ?? "draft"),
        isActive: Boolean((t as { is_active?: boolean }).is_active),
        reward: Number((t as { reward?: number }).reward ?? 0),
        slotsLeft: Number((t as { slots_left?: number }).slots_left ?? 0),
        slotsTotal: Number((t as { slots_total?: number }).slots_total ?? 0),
        link: String((t as { link?: string }).link ?? ""),
        createdAt: String((t as { created_at?: string }).created_at ?? ""),
        submissions: subCount.get(t.id) ?? 0,
      };
    });

    return {
      videos: mapped.filter((m) => m.isVideo),
      tasks: mapped.filter((m) => !m.isVideo),
      all: mapped,
    };
  });
