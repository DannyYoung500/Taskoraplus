/**
 * Strong P8 - proof integrity, referral quality, waitlist
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertOwner(userId: string) {
  const { assertOwner: ao } = await import("@/lib/owner-guard-impl");
  await ao(userId);
}

const WATERMARK_REWARD_USD = 0.15;
const REFERRAL_QUALITY_MIN_VERIFIED = 3;

async function admin() {
  const { supabaseAdmin } = await import("@/lib/supabase-admin-impl");
  return supabaseAdmin;
}

function mintWatermarkCode(userId: string, taskId: string): string {
  const raw = `${userId.slice(0, 8)}${taskId.slice(0, 8)}${Date.now().toString(36)}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) >>> 0;
  return `TK${h.toString(36).toUpperCase().slice(0, 6)}`;
}

export const mintProofWatermark = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { taskId: string }) => d)
  .handler(async ({ context, data }) => {
    const code = mintWatermarkCode(context.userId, data.taskId);
    const expiresAt = new Date(Date.now() + 15 * 60_000).toISOString();
    try {
      const s = await admin();
      await s.from("proof_watermarks").upsert(
        {
          user_id: context.userId,
          task_id: data.taskId,
          code,
          expires_at: expiresAt,
          consumed: false,
        } as never,
        { onConflict: "user_id,task_id" } as never,
      );
    } catch {
      /* soft */
    }
    return {
      code,
      expiresAt,
      instruction: `Include this code in your screenshot caption or proof text: ${code}`,
      ttlSec: 900,
    };
  });

export async function assertProofWatermark(opts: {
  userId: string;
  taskId: string;
  proofText?: string | null;
  proofUrl?: string | null;
  proofMode: string;
  rewardUsd: number;
}): Promise<void> {
  const mode = String(opts.proofMode || "").toLowerCase();
  if (mode === "auto" || mode === "automatic" || mode === "membership") return;
  if (Number(opts.rewardUsd) < WATERMARK_REWARD_USD) return;

  const text = String(opts.proofText || "").toUpperCase();
  try {
    const s = await admin();
    const { data: row } = await s
      .from("proof_watermarks")
      .select("code, expires_at, consumed")
      .eq("user_id", opts.userId)
      .eq("task_id", opts.taskId)
      .maybeSingle();
    if (!row) return;
    const r = row as { code?: string; expires_at?: string; consumed?: boolean };
    if (r.consumed) {
      throw new Error("Proof watermark already used. Re-open the task for a new code.");
    }
    if (r.expires_at && r.expires_at < new Date().toISOString()) {
      throw new Error("Proof watermark expired. Re-open the task and get a new code.");
    }
    const expected = String(r.code || "").toUpperCase();
    if (expected && !text.includes(expected)) {
      throw new Error(
        `Include watermark code ${expected} in your proof text (or visible in the screenshot).`,
      );
    }
    try {
      await s
        .from("proof_watermarks")
        .update({ consumed: true, consumed_at: new Date().toISOString() } as never)
        .eq("user_id", opts.userId)
        .eq("task_id", opts.taskId);
    } catch {
      /* soft */
    }
  } catch (e) {
    if (
      e instanceof Error &&
      (e.message.includes("watermark") || e.message.includes("Watermark"))
    ) {
      throw e;
    }
  }
}

export async function assertProofUrlNotShared(opts: {
  userId: string;
  proofUrl?: string | null;
}): Promise<void> {
  const url = String(opts.proofUrl || "").trim();
  if (!url || url.length < 12) return;
  try {
    const s = await admin();
    const { count } = await s
      .from("submissions")
      .select("id", { count: "exact", head: true })
      .eq("proof_url", url)
      .neq("user_id", opts.userId)
      .limit(5);
    if ((count ?? 0) >= 1) {
      throw new Error("This proof image was already used by another account. Upload an original screenshot.");
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("already used")) throw e;
  }
}

export async function getReferralQualityScore(opts: { referrerUserId: string }): Promise<{
  score: number;
  invited: number;
  verifiedReferees: number;
  totalRefereeVerifies: number;
  factors: string[];
}> {
  const factors: string[] = [];
  let invited = 0;
  let verifiedReferees = 0;
  let totalRefereeVerifies = 0;
  try {
    const s = await admin();
    const { data: refs } = await s
      .from("profiles")
      .select("id")
      .eq("referred_by", opts.referrerUserId)
      .limit(200);
    const ids = (refs ?? []).map((r) => String((r as { id: string }).id));
    invited = ids.length;
    if (!ids.length) {
      return { score: 0, invited: 0, verifiedReferees: 0, totalRefereeVerifies: 0, factors: ["no_referrals"] };
    }
    const { data: subs } = await s
      .from("submissions")
      .select("user_id, status")
      .in("user_id", ids)
      .in("status", ["verified", "approved", "auto_approved"] as never)
      .limit(500);
    const byUser = new Map<string, number>();
    for (const row of subs ?? []) {
      const uid = String((row as { user_id?: string }).user_id || "");
      byUser.set(uid, (byUser.get(uid) ?? 0) + 1);
      totalRefereeVerifies += 1;
    }
    verifiedReferees = [...byUser.values()].filter((n) => n >= 1).length;
    const qualityReferees = [...byUser.values()].filter((n) => n >= REFERRAL_QUALITY_MIN_VERIFIED).length;
    factors.push(`invited_${invited}`);
    factors.push(`verified_refs_${verifiedReferees}`);
    factors.push(`quality_refs_${qualityReferees}`);
  } catch {
    factors.push("score_error");
  }

  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        (verifiedReferees / Math.max(1, invited)) * 40 +
          Math.min(40, totalRefereeVerifies * 2) +
          Math.min(20, invited),
      ),
    ),
  );
  return { score, invited, verifiedReferees, totalRefereeVerifies, factors };
}

export const getMyReferralQuality = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return getReferralQualityScore({ referrerUserId: context.userId });
  });

export const ownerGetReferralQuality = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ context, data }) => {
    await assertOwner(context.userId);
    return getReferralQualityScore({ referrerUserId: data.userId });
  });

export const joinTaskWaitlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { taskId: string }) => d)
  .handler(async ({ context, data }) => {
    try {
      const s = await admin();
      await s.from("task_waitlist").upsert(
        {
          user_id: context.userId,
          task_id: data.taskId,
          notified: false,
          created_at: new Date().toISOString(),
        } as never,
        { onConflict: "user_id,task_id" } as never,
      );
    } catch {
      /* soft */
    }
    return { ok: true as const };
  });

export async function notifyTaskWaitlist(opts: { taskId: string; limit?: number }) {
  const limit = Math.min(50, Math.max(1, Number(opts.limit ?? 20)));
  let notified = 0;
  try {
    const s = await admin();
    const { data: rows } = await s
      .from("task_waitlist")
      .select("id, user_id")
      .eq("task_id", opts.taskId)
      .eq("notified", false)
      .limit(limit);
    for (const row of rows ?? []) {
      const r = row as { id: string; user_id: string };
      try {
        const { sendUserHtml } = await import("@/lib/notify-user");
        await sendUserHtml({
          userId: r.user_id,
          text: "Slots reopened on a task you waitlisted. Open Tasks and claim before they fill.",
        });
      } catch {
        /* soft */
      }
      try {
        await s
          .from("task_waitlist")
          .update({ notified: true, notified_at: new Date().toISOString() } as never)
          .eq("id", r.id);
        notified += 1;
      } catch {
        /* soft */
      }
    }
  } catch {
    /* soft */
  }
  return { notified };
}

export const ownerNotifyTaskWaitlist = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { taskId: string }) => d)
  .handler(async ({ context, data }) => {
    await assertOwner(context.userId);
    return notifyTaskWaitlist({ taskId: data.taskId });
  });
