import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const ownerRunStuckTaskSla = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertOwner } = await import("@/lib/owner-guard-impl");
    await assertOwner(context.userId);
    const { runStuckTaskSla } = await import("@/lib/strong-plus-impl");
    return runStuckTaskSla();
  });

export const ownerRunAdvertiserReputation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertOwner } = await import("@/lib/owner-guard-impl");
    await assertOwner(context.userId);
    const { ownerRunAdvertiserReputationInternal } = await import("@/lib/strong-plus-impl");
    return ownerRunAdvertiserReputationInternal(context.userId);
  });
