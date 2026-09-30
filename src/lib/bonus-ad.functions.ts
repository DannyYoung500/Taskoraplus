import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * 8 · Bonus ad credit.
 * Wire Monetag / Adsgram / PropellerAds client SDK in watch-earn UI:
 *   1) Open ad unit (show)
 *   2) On reward callback, call creditBonusAd({ data: { sdkToken } })
 * Server validates rate limits + daily cap; sdkToken reserved for future signature check.
 */
export const creditBonusAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { sdkToken?: string }) => d ?? {})
  .handler(async ({ data, context }) => {
    void data;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const s = supabaseAdmin;

    try {
      const { assertActionRateLimit } = await import("@/lib/strong-ops");
      await assertActionRateLimit({ userId: context.userId, kind: "bonus_ad" });
    } catch (e) {
      if (e instanceof Error && e.message.includes("Too many")) throw e;
    }

    const { data: ecoRow } = await s.from("app_settings").select("value").eq("key", "economy").maybeSingle();
    const eco = (ecoRow?.value ?? {}) as Record<string, unknown>;
    const reward = Math.max(0, Number(eco.bonus_ad_reward_usdt ?? 0.003));
    const dailyLimit = Math.max(0, Math.min(50, Math.floor(Number(eco.bonus_ad_daily_limit ?? 5))));
    if (reward <= 0 || dailyLimit <= 0) {
      throw new Error("Bonus ads are disabled by the owner.");
    }

    const today = new Date().toISOString().slice(0, 10);
    const dayStart = `${today}T00:00:00.000Z`;
    const { count } = await s
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("kind", "reward")
      .ilike("label", "Bonus ad%")
      .gte("created_at", dayStart);
    const used = Number(count ?? 0);
    if (used >= dailyLimit) {
      throw new Error(`Daily bonus ad limit reached (${dailyLimit}). Try again tomorrow.`);
    }

    const { error } = await s.from("transactions").insert({
      user_id: context.userId,
      label: "Bonus ad",
      amount: reward,
      kind: "reward",
    });
    if (error) throw new Error(error.message);

    return {
      ok: true as const,
      rewardUsdt: reward,
      left: Math.max(0, dailyLimit - used - 1),
      dailyLimit,
    };
  });
