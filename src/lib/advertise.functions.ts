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

export const listAdvertiseServices = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("advertise_service_catalog")
    .select("*")
    .eq("active", true)
    .order("platform")
    .order("service_name");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getAdvertisePostingAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile, error } = await supabaseAdmin
      .from("profiles")
      .select("telegram_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { ownerFree: isOwnerTelegramId(profile?.telegram_id ?? null) };
  });

export const createAdvertiseCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      serviceId: string;
      title?: string;
      link: string;
      quantity: number;
      watchSeconds?: number;
      videoSource?: string;
      videoDurationSeconds?: number;
      targetCountryCode?: string;
      targetCountryName?: string;
      allowOtherCountriesIfUnavailable?: boolean;
      description?: string;
      instructions?: string;
      warningText?: string;
      proofRequirements?: string[];
      difficulty?: "easy" | "medium" | "hard";
      screenshotsRequired?: number;
      featured?: boolean;
      ownerRewardPerTask?: number;
      verificationMode?: "automatic" | "screenshot";
    }) => d,
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: service, error: serviceError }, { data: economy, error: economyError }] =
      await Promise.all([
        supabaseAdmin
          .from("advertise_service_catalog")
          .select("*")
          .eq("service_id", data.serviceId)
          .eq("active", true)
          .maybeSingle(),
        supabaseAdmin.from("advertise_economy_settings").select("*").eq("id", true).maybeSingle(),
      ]);
    if (serviceError) throw new Error(serviceError.message);
    if (economyError) throw new Error(economyError.message);
    if (!service) throw new Error("Advertise service is unavailable.");

    let ownerFree = false;
    try {
      const { data: ownerProfile } = await supabaseAdmin
        .from("profiles")
        .select("telegram_id")
        .eq("id", context.userId)
        .maybeSingle();
      ownerFree = isOwnerTelegramId(ownerProfile?.telegram_id ?? null);
    } catch {}

    let quantity = Math.floor(Number(data.quantity));
    if (quantity < Number(service.min_quantity) || quantity > Number(service.max_quantity)) {
      throw new Error(
        `Quantity must be between ${service.min_quantity.toLocaleString()} and ${service.max_quantity.toLocaleString()}.`,
      );
    }
    const minWatch = Number(economy?.youtube_watch_min_seconds ?? 1);
    const maxWatch = Number(economy?.youtube_watch_max_seconds ?? 10800);
    const watchSeconds =
      service.pricing_model === "watch_second" ? Math.floor(Number(data.watchSeconds ?? 0)) : 0;
    const detectedVideoDuration =
      service.pricing_model === "watch_second"
        ? Math.floor(Number(data.videoDurationSeconds ?? 0))
        : 0;
    if (
      service.pricing_model === "watch_second" &&
      detectedVideoDuration > 0 &&
      watchSeconds > detectedVideoDuration
    ) {
      throw new Error(
        `Watch duration cannot exceed the detected YouTube video length (${Math.floor(detectedVideoDuration / 60)}m ${detectedVideoDuration % 60}s).`,
      );
    }
    if (
      service.pricing_model === "watch_second" &&
      (watchSeconds < minWatch || watchSeconds > maxWatch)
    ) {
      throw new Error(`Watch duration must be between ${minWatch} and ${maxWatch} seconds.`);
    }

    const target = String(data.link || "").trim();
    const targetCountryCode = String(data.targetCountryCode || "").trim().toUpperCase();
    const targetCountryName = String(data.targetCountryName || "").trim() || null;
    const allowOtherCountriesIfUnavailable = data.allowOtherCountriesIfUnavailable !== false;
    if (targetCountryCode && !/^[A-Z]{2}$/.test(targetCountryCode)) {
      throw new Error("Choose a valid country.");
    }
    if (!/^https?:\/\//i.test(target)) throw new Error("Enter a valid video or target URL.");
    assertPlatformUrl(String(service.platform), target);

    // Strong Telegram channel / group / bot link validation
    if (String(service.platform).toLowerCase() === "telegram") {
      const { assertTelegramTargetForService } = await import("@/lib/telegram-link.functions");
      await assertTelegramTargetForService({
        serviceId: String(service.service_id),
        link: target,
      });
    }

    const unitService = {
      serviceId: service.service_id,
      platform: service.platform,
      serviceName: service.service_name,
      taskType: service.task_type,
      minQuantity: Number(service.min_quantity),
      maxQuantity: Number(service.max_quantity),
      customerUnitPrice: Number(service.customer_unit_price),
      taskerUnitReward: Number(service.tasker_unit_reward),
      taskoraUnitMargin: Number(service.taskora_unit_margin),
      pricingModel: service.pricing_model,
    } as const;
    const pricing = calculateAdvertiseOrder(unitService, quantity, watchSeconds);

    const catalogTaskReward =
      service.pricing_model === "watch_second"
        ? Number((Number(service.tasker_unit_reward) * watchSeconds).toFixed(8))
        : Number(service.tasker_unit_reward);
    const ownerRewardInput = Number(data.ownerRewardPerTask);
    if (
      ownerFree &&
      data.ownerRewardPerTask !== undefined &&
      (!Number.isFinite(ownerRewardInput) || ownerRewardInput <= 0 || ownerRewardInput > 10)
    ) {
      throw new Error("Owner reward must be greater than $0 and no more than $10 per completion.");
    }
    const perTaskReward =
      ownerFree && data.ownerRewardPerTask !== undefined
        ? Number(ownerRewardInput.toFixed(8))
        : catalogTaskReward;
    if (ownerFree && perTaskReward * quantity > 1000) {
      throw new Error("Owner-sponsored reward total cannot exceed $1,000 per campaign.");
    }
    const featureFee = Boolean(data.featured) ? 5 : 0;
    const customerTotalWithFeature = Number((pricing.customerTotal + featureFee).toFixed(8));

    const perTaskCustomer =
      service.pricing_model === "watch_second"
        ? Number((Number(service.customer_unit_price) * watchSeconds).toFixed(8))
        : Number(service.customer_unit_price);

    const verificationMode =
      service.pricing_model === "watch_second"
        ? "automatic"
        : data.verificationMode === "automatic"
          ? "automatic"
          : "screenshot";
    const verificationMethods = [verificationMode];

    let proofRequirements = Array.isArray(data.proofRequirements)
      ? data.proofRequirements.filter((v) =>
          ["screenshot", "link", "watch_completion", "automatic"].includes(String(v)),
        )
      : service.pricing_model === "watch_second"
        ? ["watch_completion"]
        : verificationMode === "automatic"
          ? ["automatic"]
          : ["screenshot"];
    proofRequirements = proofRequirements.filter((v) => v !== "text" && v !== "comment");

    const difficulty =
      data.difficulty === "hard" ? "hard" : data.difficulty === "medium" ? "medium" : "easy";
    const screenshotsRequired = Math.max(
      0,
      Math.min(3, Math.floor(Number(data.screenshotsRequired ?? 1))),
    );
    const featured = Boolean(data.featured);
    const campaignTitle = String(data.title || "").trim() || service.service_name;
    const taskTitle =
      service.pricing_model === "watch_second" ? "Watch video and earn" : campaignTitle;
    const description = String(data.description || service.service_name).trim();
    const customInstructions = String(data.instructions || "").trim();
    const warningText = String(data.warningText || "").trim();
    const instructionLines = customInstructions
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);
    const steps =
      service.pricing_model === "watch_second"
        ? [
            `Watch for ${Math.floor(watchSeconds / 60)}m ${watchSeconds % 60}s`,
            "Wait for automatic verification",
          ]
        : instructionLines.length
          ? instructionLines
          : [`Complete: ${service.service_name}`, "Return to TASKORA and submit proof"];
    const taskInstructions =
      service.pricing_model === "watch_second"
        ? `Watch the video for ${watchSeconds} seconds. Taskora verifies the qualifying playback automatically.`
        : customInstructions ||
          `Complete the ${service.service_name} action and submit the required proof.`;

    const campaignId = crypto.randomUUID();
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("campaigns")
      .insert({
        id: campaignId,
        advertiser_user_id: context.userId,
        advertiser_id: context.userId,
        platform: service.platform,
        task_type: service.task_type,
        title: campaignTitle,
        instructions: taskInstructions,
        target_url: target,
        reward: perTaskReward,
        slots: quantity,
        remaining_slots: quantity,
        budget: customerTotalWithFeature,
        amount_spent: 0,
        status: "draft",
        target_country_code: targetCountryCode || null,
        target_country_name: targetCountryName,
        allow_other_countries_if_unavailable: allowOtherCountriesIfUnavailable,
        funding_status: "draft",
        funding_reserved: 0,
        funding_spent: 0,
      } as never)
      .select("*")
      .single();
    if (campaignError || !campaign) {
      throw new Error(campaignError?.message ?? "Could not create campaign.");
    }

    if (ownerFree) {
      const { error: sponsoredCampaignError } = await supabaseAdmin
        .from("campaigns")
        .update({
          owner_sponsored: true,
          funding_status: "sponsored",
          funding_reserved: 0,
          status: "active",
          budget: customerTotalWithFeature,
        } as never)
        .eq("id", campaign.id);
      if (sponsoredCampaignError) {
        const { error: retryErr } = await supabaseAdmin
          .from("campaigns")
          .update({
            funding_status: "funded",
            funding_reserved: 0,
            status: "active",
            budget: customerTotalWithFeature,
          } as never)
          .eq("id", campaign.id);
        if (retryErr) {
          await supabaseAdmin.from("campaigns").delete().eq("id", campaign.id);
          throw new Error(retryErr.message);
        }
      }
    } else {
      const { error: fundingError } = await supabaseAdmin.rpc("reserve_campaign_budget", {
        p_advertiser_id: context.userId,
        p_campaign_id: campaign.id,
        p_amount: customerTotalWithFeature,
      });
      if (fundingError) {
        await supabaseAdmin.rpc("release_campaign_budget", { p_campaign_id: campaign.id });
        await supabaseAdmin.from("campaigns").delete().eq("id", campaign.id);
        throw new Error(fundingError.message);
      }
    }

    const taskTypeDb =
      service.pricing_model === "watch_second" ? "video_watch" : service.task_type;
    const proof =
      verificationMode === "screenshot"
        ? "screenshot"
        : verificationMode === "automatic"
          ? "auto"
          : "username";
    const requiresReview = verificationMode === "screenshot";
    const taskMetadata = {
      pricing_snapshot: {
        customer_unit_price: Number(service.customer_unit_price),
        tasker_unit_reward: Number(service.tasker_unit_reward),
        taskora_unit_margin: Number(service.taskora_unit_margin),
        customer_per_completion: perTaskCustomer,
        user_reward_per_completion: perTaskReward,
        taskora_fee_per_completion: Number((perTaskCustomer - perTaskReward).toFixed(8)),
        split: { worker_percent: 70, taskora_percent: 30 },
        pricing_model: service.pricing_model,
        feature_fee: featureFee,
      },
      watch_seconds: service.pricing_model === "watch_second" ? watchSeconds : null,
      video_source:
        service.pricing_model === "watch_second" ? data.videoSource || "url" : null,
      verification_methods: verificationMethods,
      screenshot_fallback: false,
      locked_reward: true,
      creation_form: {
        description,
        instructions: customInstructions,
        warning_text: warningText,
        proof_requirements: proofRequirements,
        difficulty,
        screenshots_required: screenshotsRequired,
        featured,
      },
      owner_free_post: ownerFree,
    };

    const { data: task, error: taskError } = await supabaseAdmin
      .from("tasks")
      .insert({
        platform: service.platform,
        title: taskTitle,
        advertiser: ownerFree ? "TASKORA Owner" : "TASKORA Advertiser",
        reward: perTaskReward,
        seconds: service.pricing_model === "watch_second" ? watchSeconds : 30,
        slots_left: quantity,
        steps,
        proof,
        link: target,
        is_active: ownerFree,
        status: ownerFree ? "active" : "draft",
        task_type: taskTypeDb,
        target,
        slots_total: quantity,
        budget: customerTotalWithFeature,
        campaign_id: campaign.id,
        created_by: context.userId,
        instructions: taskInstructions,
        description,
        warning_text: warningText,
        requires_review: requiresReview,
        difficulty,
        screenshots_required: screenshotsRequired,
        proof_requirements: proofRequirements,
        featured,
        task_metadata: taskMetadata,
        target_country_code: targetCountryCode || null,
        target_country_name: targetCountryName,
        allow_other_countries_if_unavailable: allowOtherCountriesIfUnavailable,
      } as never)
      .select("*")
      .single();
    if (taskError || !task) {
      if (!ownerFree) {
        await supabaseAdmin.rpc("release_campaign_budget", { p_campaign_id: campaign.id });
      }
      await supabaseAdmin.from("campaigns").delete().eq("id", campaign.id);
      throw new Error(taskError?.message ?? "Could not create campaign task.");
    }

    return {
      campaign,
      task,
      pricing: {
        ...pricing,
        customerTotal: customerTotalWithFeature,
        featureFee,
        watchSeconds,
        perTaskReward,
        perTaskCustomer,
        verificationMethods,
      },
      status: (ownerFree ? "active" : "draft") as "active" | "draft",
      ownerFree,
    };
  });

export const listMyPosted = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tasks, error } = await supabaseAdmin
      .from("tasks")
      .select(
        "id, title, platform, task_type, status, is_active, reward, slots_left, slots_total, link, created_at, proof, campaign_id",
      )
      .eq("created_by", context.userId)
      .order("created_at", { ascending: false })
      .limit(80);
    if (error) throw new Error(error.message);
    return { tasks: tasks ?? [] };
  });
