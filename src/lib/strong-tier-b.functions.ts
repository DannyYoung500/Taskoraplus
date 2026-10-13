/**
 * Client-safe Tier B RPC wrappers. Database access lives in strong-tier-b.server.ts.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type FineKillSwitches = {
  rewarded_ads_paused: boolean;
  referral_payouts_paused: boolean;
  new_campaigns_paused: boolean;
  bonus_ads_paused: boolean;
};

export const requestAmendment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { submissionId: string; reason: string; windowHours?: number }) => d)
  .handler(async ({ data, context }) => {
    const { requestSubmissionAmendment } = await import("@/lib/strong-tier-b.server");
    return requestSubmissionAmendment({ ...data, requesterId: context.userId });
  });

export const resubmitAmendment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { submissionId: string; proofText?: string; proofUrl?: string }) => d)
  .handler(async ({ data, context }) => {
    const { resubmitAfterAmendment } = await import("@/lib/strong-tier-b.server");
    return resubmitAfterAmendment({ ...data, workerId: context.userId });
  });

export const listOpenAmendments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listOpenAmendmentsInternal } = await import("@/lib/strong-tier-b.server");
    return listOpenAmendmentsInternal(context.userId);
  });

export const ownerSetFineSwitch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: keyof FineKillSwitches; value: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { ownerSetFineSwitchInternal } = await import("@/lib/strong-tier-b.server");
    return ownerSetFineSwitchInternal(context.userId, data.key, data.value);
  });
