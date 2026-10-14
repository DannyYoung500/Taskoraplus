import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function db() {
  const { supabaseAdmin } = await import("@/lib/supabase-admin-impl");
  return supabaseAdmin;
}

export const getAdNetworkConfig = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    try {
      const s = await db();
      const { data } = await s.from("app_settings").select("value").eq("key", "ad_network").maybeSingle();
      return (data?.value ?? {}) as Record<string, unknown>;
    } catch {
      return {};
    }
  });

export const listAdOffers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    try {
      const s = await db();
      const { data } = await s
        .from("ad_offers")
        .select("id, title, reward, network, is_active")
        .eq("is_active", true)
        .limit(30);
      return { offers: data ?? [] };
    } catch {
      return { offers: [] as Array<Record<string, unknown>> };
    }
  });

export const completeAdOffer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { offerId: string; proof?: string }) => d)
  .handler(async ({ data, context }) => {
    const s = await db();
    // soft stub - real postback verification is network-specific
    return { ok: true, offerId: data.offerId };
  });
