/**
 * Strong Tier B wrappers — amendment flow + fine kill switches.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type FineKillSwitches = {
  tasks_paused: boolean;
  withdrawals_paused: boolean;
  referrals_paused: boolean;
};

export const requestAmendment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { submissionId: string; note?: string }) => d)
  .handler(async ({ data, context }) => {
    const { requestSubmissionAmendment } = await import("@/lib/strong-tier-b-impl");
    return requestSubmissionAmendment({ ...data, requesterId: context.userId });
  });

export const requestSubmissionAmendment = requestAmendment;

export const resubmitAmendment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { submissionId: string; proofText?: string; proofUrl?: string }) => d)
  .handler(async ({ data, context }) => {
    const { resubmitAfterAmendment } = await import("@/lib/strong-tier-b-impl");
    return resubmitAfterAmendment({ ...data, workerId: context.userId });
  });

export const listOpenAmendments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { listOpenAmendmentsInternal } = await import("@/lib/strong-tier-b-impl");
    return listOpenAmendmentsInternal(context.userId);
  });

export const ownerSetFineSwitch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: keyof FineKillSwitches; value: boolean }) => d)
  .handler(async ({ data, context }) => {
    const { ownerSetFineSwitchInternal } = await import("@/lib/strong-tier-b-impl");
    return ownerSetFineSwitchInternal(context.userId, data.key, data.value);
  });

export const getFineKillSwitches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getFineKillSwitches: getInternal } = await import("@/lib/strong-tier-b-impl");
    return getInternal();
  });
