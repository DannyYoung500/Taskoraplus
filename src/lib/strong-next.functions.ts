import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Owner-only wallet unfreeze RPC; implementation stays server-only. */
export const ownerUnfreezeWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; note?: string }) => d)
  .handler(async ({ data, context }) => {
    const { assertOwner, audit } = await import("@/lib/owner-guard-impl");
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/lib/supabase-admin-impl");
    const { data: prev } = await supabaseAdmin.from("profiles").select("wallet_frozen, wallet_frozen_reason").eq("id", data.userId).maybeSingle();
    const { error } = await supabaseAdmin.from("profiles").update({ wallet_frozen: false, wallet_frozen_reason: null, wallet_frozen_at: null } as never).eq("id", data.userId);
    if (error) throw new Error(error.message);
    await audit({ adminId: context.userId, action: "wallet.unfreeze", targetType: "user", targetId: data.userId, previous: prev, next: { note: data.note ?? "manual unfreeze" } });
    try {
      const { sendOwnerHtml } = await import("@/lib/notify-owner");
      await sendOwnerHtml(`🔓 <b>Wallet unfrozen</b>\nUser <code>${data.userId.slice(0, 8)}</code>\nNote: ${data.note ?? "—"}`);
    } catch {}
    return { ok: true as const };
  });

/** Public ledger is read-only and returns masked payout details. */
export const getPublicPayoutLedger = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicPayoutLedgerInternal } = await import("@/lib/strong-next-impl");
  return getPublicPayoutLedgerInternal();
});
