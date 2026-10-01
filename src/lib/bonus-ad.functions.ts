import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * 9 · Bonus ad credit with optional SDK session token.
 * Wire Monetag / Adsgram / PropellerAds in watch-earn UI:
 *   1) Call getBonusAdSession() → token
 *   2) Show ad unit
 *   3) On reward callback: creditBonusAd({ data: { sdkToken: token } })
 * Server validates rate limits + daily cap + one-time session token.
 */
export const creditBonusAd = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { sdkToken?: string }) => d ?? {})
  .handler(async ({ data, context }) => {
    const { assertNotPaused } = await import("@/lib/strong-premium.functions");
    await assertNotPaused(["watches_paused", "read_only"]);

    try {
      const { assertActionRateLimit } = await import("@/lib/strong-ops");
      await assertActionRateLimit({ userId: context.userId, kind: "bonus_ad" });
    } catch (e) {
      if (e instanceof Error && e.message.includes("Too many")) throw e;
    }

    // 9 · SDK session token (soft if client not yet passing token)
    try {
      const { assertBonusAdSessionToken } = await import("@/lib/strong-premium.functions");
      await assertBonusAdSessionToken({
        userId: context.userId,
        sdkToken: (data as { sdkToken?: string } | undefined)?.sdkToken,
      });
    } catch (e) {
      if (
        e instanceof Error &&
        (e.message.includes("bonus-ad") ||
          e.message.includes("session") ||
          e.message.includes("Invalid") ||
          e.message.includes("claimed") ||
          e.message.includes("expired"))
      ) {
        throw e;
      }
    }

    const s = await adminClient();
    const { data: ecoRow } = await s
      .from("app_settings")
      .select("value")
      .eq("key", "economy")
      .maybeSingle();
    const eco = (ecoRow?.value ?? {}) as Record<string, unknown>;
    const reward = Math.max(0, Number(eco.bonus_ad_reward_usdt ?? 0.003));
    const dailyLimit = Math.max(
      0,
      Math.min(50, Math.floor(Number(eco.bonus_ad_daily_limit ?? 5))),
    );
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

export { getBonusAdSession } from "@/lib/strong-premium.functions";
