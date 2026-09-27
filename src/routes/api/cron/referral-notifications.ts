import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { sendUserHtml, notifyReferralMilestone, notifyReferralValid } from "@/lib/notify-user";

async function run(request: Request) {
  const denied = await authenticateCronRequest(request);
  if (denied) return denied;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  let milestoneSent = 0;
  let validSent = 0;

  const { data: rewards } = await supabaseAdmin
    .from("referral_challenge_rewards")
    .select("id,inviter_user_id,referred_user_id,milestone,amount_usd")
    .is("notified_at", null)
    .order("created_at", { ascending: true })
    .limit(200);

  for (const reward of rewards ?? []) {
    const milestone = String(reward.milestone) as "join" | "tasks" | "videos" | "games" | "ads";
    if (!["join", "tasks", "videos", "games", "ads"].includes(milestone)) {
      await supabaseAdmin.from("referral_challenge_rewards").update({ notified_at: new Date().toISOString() }).eq("id", reward.id);
      continue;
    }
    const result = await notifyReferralMilestone({
      inviterUserId: String(reward.inviter_user_id),
      milestone,
      amountUsd: Number(reward.amount_usd),
    });
    if (result.ok) {
      await supabaseAdmin.from("referral_challenge_rewards").update({ notified_at: new Date().toISOString() }).eq("id", reward.id);
      milestoneSent++;
    }
  }

  const { data: validRows } = await supabaseAdmin
    .from("referral_challenge_members")
    .select("referred_user_id,inviter_user_id")
    .eq("valid_referral", true)
    .is("valid_notified_at", null)
    .limit(200);

  for (const row of validRows ?? []) {
    const result = await notifyReferralValid({
      inviterUserId: String(row.inviter_user_id),
    });
    if (result.ok) {
      await supabaseAdmin.from("referral_challenge_members")
        .update({ valid_notified_at: new Date().toISOString() })
        .eq("referred_user_id", row.referred_user_id);
      validSent++;
    }
  }

  return Response.json({ ok: true, milestoneSent, validSent });
}

export const Route = createFileRoute("/api/cron/referral-notifications")({
  server: {
    handlers: {
      GET: async ({ request }) => run(request),
      POST: async ({ request }) => run(request),
    },
  },
});
