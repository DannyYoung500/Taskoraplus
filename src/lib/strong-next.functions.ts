import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Owner-only wallet unfreeze RPC; implementation stays server-only. */
export const ownerUnfreezeWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; note?: string }) => d)
  .handler(async ({ data, context }) => {
    const { assertOwner, audit } = await import("@/lib/owner-guard.server");
    await assertOwner(context.userId);
    const { unfreezeWalletInternal } = await import("@/lib/strong-next.server");
    return unfreezeWalletInternal({ data, adminId: context.userId, audit });
  });

/** Public ledger is read-only and returns masked payout details. */
export const getPublicPayoutLedger = createServerFn({ method: "GET" }).handler(async () => {
  const { getPublicPayoutLedgerInternal } = await import("@/lib/strong-next.server");
  return getPublicPayoutLedgerInternal();
});
