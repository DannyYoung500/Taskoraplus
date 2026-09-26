import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertOwner, audit } from "@/lib/owner-guard.server";

export const ownerGetPayoutPolicy = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertOwner(context.userId);
  const { loadPayoutPolicy } = await import("@/lib/strong-guards");
  return loadPayoutPolicy();
});

export const ownerSetPayoutPolicy = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator((d: any) => d).handler(async ({ data, context }) => {
  await assertOwner(context.userId);
  const { loadPayoutPolicy } = await import("@/lib/strong-guards");
  const prev = await loadPayoutPolicy();
  const next = {
    risk_force_dual: data.risk_force_dual != null ? Math.max(0, Math.min(100, Number(data.risk_force_dual))) : prev.risk_force_dual,
    risk_auto_freeze: data.risk_auto_freeze != null ? Math.max(0, Math.min(100, Number(data.risk_auto_freeze))) : prev.risk_auto_freeze,
    max_withdrawals_per_day: data.max_withdrawals_per_day != null ? Math.max(1, Math.min(20, Number(data.max_withdrawals_per_day))) : prev.max_withdrawals_per_day,
    country_deny: Array.isArray(data.country_deny) ? data.country_deny.map((x: string) => x.toUpperCase().slice(0, 2)).filter(Boolean) : prev.country_deny,
    country_allow: Array.isArray(data.country_allow) ? data.country_allow.map((x: string) => x.toUpperCase().slice(0, 2)).filter(Boolean) : prev.country_allow,
  };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("app_settings").upsert({ key: "payout_policy", value: next } as never, { onConflict: "key" });
  if (error) throw new Error(error.message);
  await audit({ adminId: context.userId, action: "payout_policy.update", targetType: "settings", targetId: "payout_policy", previous: prev, next }).catch(() => undefined);
  return { ok: true, policy: next };
});

export const ownerGetNotificationSettings = createServerFn({ method: "GET" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  await assertOwner(context.userId);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any).from("taskora_notification_settings").select("*").eq("id", true).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
});

export const ownerSetNotificationSettings = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((d: { payout_message_template: string; payout_image_data_url?: string; payout_image_file_name?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let imageUrl: string | null = null;
    if (data.payout_image_data_url?.trim()) {
      const match = data.payout_image_data_url.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/);
      if (!match) throw new Error("Payout image must be PNG, JPG or WebP.");
      const bytes = Uint8Array.from(atob(match[2]!), c => c.charCodeAt(0));
      const ext = match[1] === "image/png" ? "png" : match[1] === "image/webp" ? "webp" : "jpg";
      const path = `payout-${Date.now()}.${ext}`;
      const upload = await supabaseAdmin.storage.from("payout-proofs").upload(path, bytes, { contentType: match[1]!, upsert: true });
      if (upload.error) throw new Error(upload.error.message);
      imageUrl = supabaseAdmin.storage.from("payout-proofs").getPublicUrl(path).data.publicUrl;
    }
    const next: Record<string, unknown> = { payout_message_template: String(data.payout_message_template || "").slice(0, 3800), updated_at: new Date().toISOString() };
    if (imageUrl) { next.payout_image_url = imageUrl; next.payout_image_file_name = String(data.payout_image_file_name || "payout-image").slice(0, 120); }
    const { data: saved, error } = await (supabaseAdmin as any).from("taskora_notification_settings").upsert({ id: true, ...next }, { onConflict: "id" }).select("*").single();
    if (error) throw new Error(error.message);
    await audit({ adminId: context.userId, action: "telegram_notifications.update", targetType: "settings", targetId: "taskora_notification_settings", next: { hasPayoutImage: Boolean(imageUrl) } }).catch(() => undefined);
    return saved;
  });
