import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnerTelegramId } from "@/lib/owner";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function assertOwner(userId: string) {
  const s = await adminClient();
  const { data: role } = await s.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (role) return;
  const { data: p } = await s.from("profiles").select("telegram_id").eq("id", userId).maybeSingle();
  if (isOwnerTelegramId((p as any)?.telegram_id ?? null)) return;
  throw new Error("Owner/admin authorization required.");
}

export type MonetizationProvider = {
  id: string;
  category: string;
  providerKey: string;
  providerName: string;
  enabled: boolean;
  priority: number;
  apiBaseUrl: string | null;
  publicId: string | null;
  placementId: string | null;
  postbackUrl: string | null;
  webhookUrl: string | null;
  revenueSharePercent: number | null;
  userRewardSharePercent: number | null;
  minimumPayoutUsd: number | null;
  settings: Record<string, unknown>;
  secretNames: string[];
};

const CATALOG = [
  ["games", "playgama", "Playgama"],
  ["games", "gamezop", "Gamezop"],
  ["games", "gamedistribution", "GameDistribution"],
  ["games", "gamemonetize", "GameMonetize"],
  ["games", "gamepix", "GamePix"],
  ["ads", "adsgram", "AdsGram"],
  ["ads", "monetag", "Monetag"],
  ["ads", "onclicka", "OnClickA"],
  ["ads", "richads", "RichAds"],
  ["ads", "gigapub", "GigaPub"],
  ["ads", "tads", "TADS"],
  ["videos", "youtube", "YouTube"],
  ["videos", "tiktok", "TikTok"],
  ["videos", "x", "X"],
  ["videos", "instagram", "Instagram"],
  ["videos", "facebook", "Facebook"],
  ["offerwalls", "adgem", "AdGem"],
  ["offerwalls", "offerwall_gg", "Offerwall.GG"],
  ["offerwalls", "adswedmedia", "AdswedMedia"],
  ["offerwalls", "kooads", "KooAds"],
  // Crypto payment gateways (Payment Settings)
  ["offerwalls", "oxapay", "OxaPay"],
  ["offerwalls", "cryptomus", "Cryptomus"],
  ["offerwalls", "nowpayments", "NOWPayments"],
  ["offerwalls", "coingate", "CoinGate"],
  ["offerwalls", "coinpayments", "CoinPayments"],
  ["offerwalls", "binance_pay", "Binance Pay"],
  ["offerwalls", "coinbase_commerce", "Coinbase Commerce"],
  ["offerwalls", "btcpay", "BTCPay Server"],
] as const;

function fallback([category, key, name]: (typeof CATALOG)[number]): MonetizationProvider {
  return {
    id: `catalog:${key}`,
    category,
    providerKey: key,
    providerName: name,
    enabled: false,
    priority: 100,
    apiBaseUrl: null,
    publicId: null,
    placementId: null,
    postbackUrl: null,
    webhookUrl: null,
    revenueSharePercent: null,
    userRewardSharePercent: null,
    minimumPayoutUsd: null,
    settings: {},
    secretNames: [],
  };
}

function map(row: any): MonetizationProvider {
  return {
    id: String(row.id),
    category: String(row.category),
    providerKey: String(row.provider_key),
    providerName: String(row.provider_name),
    enabled: Boolean(row.enabled),
    priority: Number(row.priority ?? 100),
    apiBaseUrl: row.api_base_url ?? null,
    publicId: row.public_id ?? null,
    placementId: row.placement_id ?? null,
    postbackUrl: row.postback_url ?? null,
    webhookUrl: row.webhook_url ?? null,
    revenueSharePercent: row.revenue_share_percent == null ? null : Number(row.revenue_share_percent),
    userRewardSharePercent:
      row.user_reward_share_percent == null ? null : Number(row.user_reward_share_percent),
    minimumPayoutUsd: row.minimum_payout_usd == null ? null : Number(row.minimum_payout_usd),
    settings: (row.settings ?? {}) as Record<string, unknown>,
    secretNames: Array.isArray(row.secret_names) ? row.secret_names.map(String) : [],
  };
}

export const listMonetizationProviders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const s = await adminClient();
    try {
      const { data, error } = await (s as any)
        .from("monetization_providers")
        .select("*")
        .order("category")
        .order("priority");
      if (error) throw error;
      const rows = (data ?? []) as any[];
      const byKey = new Map(rows.map((r) => [String(r.provider_key), map(r)]));
      return CATALOG.map((f) => byKey.get(f[1]) ?? fallback(f));
    } catch {
      return CATALOG.map(fallback);
    }
  });

export const saveMonetizationProvider = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id: string;
      providerKey?: string;
      providerName?: string;
      category?: string;
      enabled: boolean;
      priority: number;
      apiBaseUrl?: string;
      publicId?: string;
      placementId?: string;
      postbackUrl?: string;
      webhookUrl?: string;
      revenueSharePercent?: number | null;
      userRewardSharePercent?: number | null;
      minimumPayoutUsd?: number | null;
      settings?: Record<string, unknown>;
      secrets?: Array<{ name: string; value: string; description?: string }>;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const s = await adminClient();
    let provider: any = null;
    if (data.id && !data.id.startsWith("catalog:")) {
      const r = await (s as any)
        .from("monetization_providers")
        .select("provider_key,provider_name,category,secret_names")
        .eq("id", data.id)
        .maybeSingle();
      provider = r.data;
    }
    if (!provider && data.providerKey) {
      const r = await (s as any)
        .from("monetization_providers")
        .select("provider_key,provider_name,category,secret_names")
        .eq("provider_key", data.providerKey)
        .maybeSingle();
      provider = r.data;
    }
    if (!provider && data.providerKey) {
      const ins = await (s as any)
        .from("monetization_providers")
        .insert({
          category: data.category ?? "other",
          provider_key: data.providerKey,
          provider_name: data.providerName ?? data.providerKey,
          enabled: false,
          priority: 100,
          secret_names: [],
        })
        .select("provider_key,provider_name,category,secret_names")
        .single();
      if (ins.error) throw new Error(ins.error.message);
      provider = ins.data;
    }
    if (!provider) throw new Error("Provider not found.");

    const secretNames: Array<string> = Array.isArray(provider.secret_names)
      ? provider.secret_names.map(String)
      : [];
    for (const secret of data.secrets ?? []) {
      if (!secret.value.trim()) continue;
      const safeName = `taskora_${String(provider.provider_key).replace(/[^a-z0-9_]/gi, "_")}_${secret.name.replace(/[^a-z0-9_]/gi, "_")}`;
      const { data: secretId, error: secretError } = await (s as any).rpc(
        "owner_monetization_save_secret",
        {
          p_name: safeName,
          p_secret: secret.value.trim(),
          p_description: secret.description ?? `${provider.provider_name} ${secret.name}`,
        },
      );
      if (secretError) throw new Error(secretError.message);
      if (secretId && !secretNames.includes(safeName)) secretNames.push(safeName);
    }

    const { data: updated, error: updateError } = await (s as any)
      .from("monetization_providers")
      .update({
        enabled: Boolean(data.enabled),
        priority: Math.max(1, Math.floor(Number(data.priority) || 100)),
        api_base_url: data.apiBaseUrl?.trim() || null,
        public_id: data.publicId?.trim() || null,
        placement_id: data.placementId?.trim() || null,
        postback_url: data.postbackUrl?.trim() || null,
        webhook_url: data.webhookUrl?.trim() || null,
        revenue_share_percent:
          data.revenueSharePercent == null ? null : Number(data.revenueSharePercent),
        user_reward_share_percent:
          data.userRewardSharePercent == null ? null : Number(data.userRewardSharePercent),
        minimum_payout_usd: data.minimumPayoutUsd == null ? null : Number(data.minimumPayoutUsd),
        settings: data.settings ?? {},
        secret_names: secretNames,
        updated_at: new Date().toISOString(),
      })
      .eq("provider_key", provider.provider_key)
      .select("*")
      .single();
    if (updateError) throw new Error(updateError.message);
    return map(updated);
  });
