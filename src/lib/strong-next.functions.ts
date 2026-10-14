import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getPublicPayoutLedger = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { getPublicPayoutLedgerInternal } = await import("@/lib/strong-next-impl");
    return getPublicPayoutLedgerInternal();
  } catch {
    return { rows: [] as Array<Record<string, unknown>> };
  }
});

export const ownerGetPublicPayoutLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertOwner } = await import("@/lib/owner-guard-impl");
    await assertOwner(context.userId);
    const { getPublicPayoutLedgerInternal } = await import("@/lib/strong-next-impl");
    return getPublicPayoutLedgerInternal();
  });
