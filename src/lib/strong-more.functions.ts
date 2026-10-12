import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getOwnerRiskHeatmap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertOwner } = await import("@/lib/owner-guard.server");
    await assertOwner(context.userId);
    const { getOwnerRiskHeatmapInternal } = await import("@/lib/strong-more.server");
    return getOwnerRiskHeatmapInternal();
  });

export const getVerifiedSparkline = createServerFn({ method: "GET" }).handler(async () => {
  const { getVerifiedSparklineInternal } = await import("@/lib/strong-more.server");
  return getVerifiedSparklineInternal();
});
