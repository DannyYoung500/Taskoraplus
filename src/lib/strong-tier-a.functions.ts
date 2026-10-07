/**
 * TASKORA Tier A strength (real production):
 * 1 Money session token (initData → short-lived server token)
 * 2 Postback-only ad credit helpers (AdsGram + Monetag)
 * 3 Referral graph / cluster velocity hold
 * 4 Task quality score
 * 5 Simultaneous dual-review helpers (schema-ready)
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Web Crypto random hex (edge-safe). */
async function randomHex(bytes = 16): Promise<string> {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/* ═══════════════════════════════════════════════════════════════
 * 1 · Money session token
 * Validate Telegram initData once, then require this short token
 * on withdraw / high-value claims instead of replaying initData.
 * ═══════════════════════════════════════════════════════════════ */

export async function mintMoneySession(opts: {
  userId: string;
  initData?: string | null;
  /** Default 5 minutes for money paths */
  ttlSeconds?: number;
}): Promise<{ sessionToken: string; expiresAt: string }> {
  const raw = String(opts.initData ?? "").trim();
  if (!raw) {
    throw new Error(
      "Open TASKORA from Telegram and try again. Fresh session required for money actions.",
    );
  }
  const token = process.env.TELEGRAM_BOT_TOKEN ?? process.env.BOT_TOKEN ?? "";
  if (token) {
    const { validateTelegramInitData } = await import("@/lib/telegram-initdata");
    await validateTelegramInitData(raw, token, opts.ttlSeconds ?? 300);
  }

  const sessionToken = await randomHex(20);
  const ttl = Math.max(60, Math.min(900, opts.ttlSeconds ?? 300));
  const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();

  try {
    const s = await adminClient();
    await s.from("app_settings").upsert(
      {
        key: `money_session:${opts.userId}`,
        value: { token: sessionToken, expiresAt, used: false, createdAt: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "key" },
    );
  } catch {
    /* soft — still return token; assert will fail closed if store missing */
  }

  return { sessionToken, expiresAt };
}

export const getMoneySession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { initData?: string }) => d ?? {})
  .handler(async ({ data, context }) => {
    return mintMoneySession({
      userId: context.userId,
      initData: (data as { initData?: string } | undefined)?.initData,
      ttlSeconds: 300,
    });
  });

/** Require a valid, unused money session token (or fall back to hard initData). */
export async function assertMoneySessionOrInitData(opts: {
  userId: string;
  sessionToken?: string | null;
  initData?: string | null;
  maxAgeSeconds?: number;
}): Promise<{ source: "session" | "initData" }> {
  const sessionTok = String(opts.sessionToken ?? "").trim();
  if (sessionTok.length >= 20) {
    try {
      const s = await adminClient();
      const { data } = await s
        .from("app_settings")
        .select("value")
        .eq("key", `money_session:${opts.userId}`)
        .maybeSingle();
      const v = (data?.value ?? {}) as {
        token?: string;
        expiresAt?: string;
        used?: boolean;
      };
      if (v.token && v.token === sessionTok) {
        if (v.used) {
          throw new Error("Money session already used. Request a fresh session.");
        }
        if (v.expiresAt && new Date(v.expiresAt).getTime() < Date.now()) {
          throw new Error("Money session expired. Re-open TASKORA from Telegram.");
        }
        await s.from("app_settings").upsert(
          {
            key: `money_session:${opts.userId}`,
            value: { ...v, used: true },
            updated_at: new Date().toISOString(),
          } as never,
          { onConflict: "key" },
        );
        return { source: "session" };
      }
    } catch (e) {
      if (
        e instanceof Error &&
        (e.message.includes("session") || e.message.includes("expired") || e.message.includes("used"))
      ) {
        throw e;
      }
    }
  }

  const { assertHardInitDataForMoney } = await import("@/lib/strong-more.functions");
  await assertHardInitDataForMoney({
    initData: opts.initData,
    maxAgeSeconds: opts.maxAgeSeconds ?? 300,
  });
  return { source: "initData" };
}

/* ═══════════════════════════════════════════════════════════════
 * 2 · Postback helpers (server-side only credit)
 * ═══════════════════════════════════════════════════════════════ */

export function assertPostbackSecret(requestUrl: string): void {
  const secret =
    process.env.ADS_POSTBACK_SECRET ??
    process.env.ADSGRAM_POSTBACK_SECRET ??
    process.env.MONETAG_POSTBACK_SECRET ??
    "";
  if (!secret) return;
  const url = new URL(requestUrl);
  const got =
    url.searchParams.get("secret") ||
    url.searchParams.get("key") ||
    url.searchParams.get("token") ||
    "";
  if (got !== secret) {
    throw new Error("Invalid postback secret");
  }
}

export async function creditDailyMissionFromPostback(opts: {
  telegramId: string;
  providerKey: "adsgram" | "monetag";
  claimId?: string | null;
  eventId?: string | null;
}): Promise<{ ok: boolean; credited: boolean; reason?: string }> {
  const s = await adminClient();
  const { data: profile } = await s
    .from("profiles")
    .select("id")
    .eq("telegram_id", opts.telegramId)
    .maybeSingle();
  if (!profile) return { ok: false, credited: false, reason: "user_not_found" };

  let claim: { id: string; mission_id: string; status: string } | null = null;
  if (opts.claimId) {
    const { data } = await (s as any)
      .from("daily_mission_claims")
      .select("id, mission_id, status")
      .eq("id", opts.claimId)
      .eq("user_id", profile.id)
      .maybeSingle();
    claim = data;
  }
  if (!claim) {
    const { data } = await (s as any)
      .from("daily_mission_claims")
      .select("id, mission_id, status")
      .eq("user_id", profile.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    claim = data;
  }
  if (!claim) return { ok: true, credited: false, reason: "no_pending_claim" };
  if (claim.status === "completed") return { ok: true, credited: false, reason: "already_completed" };

  const { data: mission } = await (s as any)
    .from("daily_missions")
    .select("id, title, reward_usdt, reward_points, provider_key, is_active")
    .eq("id", claim.mission_id)
    .maybeSingle();
  if (!mission || mission.provider_key !== opts.providerKey || !mission.is_active) {
    return { ok: true, credited: false, reason: "claim_provider_mismatch" };
  }

  const eventId =
    opts.eventId ||
    `${opts.providerKey}:reward:${opts.telegramId}:${claim.id}`;

  const { data: updated, error } = await (s as any)
    .from("daily_mission_claims")
    .update({
      status: "completed",
      provider_event_id: eventId,
      reward_usdt: Number(mission.reward_usdt || 0),
      reward_points: Number(mission.reward_points || 0),
      completed_at: new Date().toISOString(),
    })
    .eq("id", claim.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error || !updated) return { ok: true, credited: false, reason: "already_processed" };

  if (Number(mission.reward_usdt || 0) > 0) {
    const { error: e } = await s.from("transactions").insert({
      user_id: profile.id,
      label: `Daily mission — ${String(mission.title)}`,
      amount: Number(mission.reward_usdt),
      kind: "reward",
    });
    if (e) return { ok: false, credited: false, reason: e.message };
  }
  if (Number(mission.reward_points || 0) > 0) {
    const { data: p } = await s.from("profiles").select("task_points").eq("id", profile.id).maybeSingle();
    await s
      .from("profiles")
      .update({
        task_points: Number((p as { task_points?: number } | null)?.task_points || 0) + Number(mission.reward_points),
      } as never)
      .eq("id", profile.id);
  }
  try {
    await s.from("notifications").insert({
      user_id: profile.id,
      title: "Daily mission completed",
      body: "Your ad reward was confirmed by the ad network.",
      category: "daily_mission",
    });
  } catch {
    /* soft */
  }
  return { ok: true, credited: true };
}

/* ═══════════════════════════════════════════════════════════════
 * 3 · Referral graph / cluster velocity
 * ═══════════════════════════════════════════════════════════════ */

export async function assertReferralClusterOk(opts: {
  inviterId: string;
  refereeId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  if (!opts.inviterId || !opts.refereeId || opts.inviterId === opts.refereeId) {
    return { ok: false, reason: "invalid_pair" };
  }
  try {
    const { assertReferralFraudGate } = await import("@/lib/strong-premium.functions");
    const gate = await assertReferralFraudGate({
      inviterId: opts.inviterId,
      refereeUserId: opts.refereeId,
    });
    if (!gate.ok) return { ok: false, reason: gate.reason };

    const s = await adminClient();
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { data: recentRefs } = await s
      .from("profiles")
      .select("id, device_fp, last_ip_hint, created_at")
      .eq("referred_by", opts.inviterId)
      .gte("created_at", since)
      .limit(30);

    const refs = recentRefs ?? [];
    if (refs.length >= 8) {
      return { ok: false, reason: "invite_velocity_24h" };
    }

    const { data: referee } = await s
      .from("profiles")
      .select("device_fp, last_ip_hint")
      .eq("id", opts.refereeId)
      .maybeSingle();
    const refFp = String((referee as { device_fp?: string } | null)?.device_fp ?? "");
    const refIp = String((referee as { last_ip_hint?: string } | null)?.last_ip_hint ?? "");

    let sameCluster = 0;
    for (const r of refs) {
      const fp = String((r as { device_fp?: string }).device_fp ?? "");
      const ip = String((r as { last_ip_hint?: string }).last_ip_hint ?? "");
      if (refFp.length >= 8 && fp === refFp) sameCluster += 1;
      else if (refIp.length >= 4 && ip && ip.slice(0, 8) === refIp.slice(0, 8)) sameCluster += 1;
    }
    if (sameCluster >= 3) {
      return { ok: false, reason: "referral_cluster" };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: "gate_error" };
  }
}

/* ═══════════════════════════════════════════════════════════════
 * 4 · Task quality score (0–100)
 * ═══════════════════════════════════════════════════════════════ */

export async function computeTaskQualityScore(taskId: string): Promise<{
  score: number;
  samples: number;
  completionRate: number;
  rejectRate: number;
}> {
  try {
    const s = await adminClient();
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { data: rows } = await s
      .from("submissions")
      .select("status")
      .eq("task_id", taskId)
      .gte("created_at", since)
      .limit(200);
    const samples = (rows ?? []).length;
    if (samples < 5) {
      return { score: 70, samples, completionRate: 0, rejectRate: 0 };
    }
    const verified = (rows ?? []).filter((r) =>
      ["verified", "approved", "auto_approved"].includes(String((r as { status?: string }).status)),
    ).length;
    const rejected = (rows ?? []).filter(
      (r) => String((r as { status?: string }).status) === "rejected",
    ).length;
    const completionRate = verified / samples;
    const rejectRate = rejected / samples;
    let score = Math.round(completionRate * (1 - rejectRate) * 100);
    score = Math.max(0, Math.min(100, score));
    return { score, samples, completionRate, rejectRate };
  } catch {
    return { score: 70, samples: 0, completionRate: 0, rejectRate: 0 };
  }
}

export async function qualityRankBoost(taskId: string): Promise<number> {
  const q = await computeTaskQualityScore(taskId);
  if (q.samples < 8) return 0;
  if (q.score >= 80) return 8;
  if (q.score >= 60) return 2;
  if (q.score < 35) return -15;
  if (q.score < 50) return -5;
  return 0;
}

/* ═══════════════════════════════════════════════════════════════
 * 5 · Dual review (worker ↔ advertiser)
 * ═══════════════════════════════════════════════════════════════ */

export async function submitDualReview(opts: {
  submissionId: string;
  raterUserId: string;
  role: "worker" | "advertiser";
  stars: number;
  comment?: string;
}): Promise<{ ok: boolean; revealed: boolean }> {
  const stars = Math.max(1, Math.min(5, Math.round(opts.stars)));
  try {
    const s = await adminClient();
    const { data: sub } = await s
      .from("submissions")
      .select("id, user_id, task_id, status")
      .eq("id", opts.submissionId)
      .maybeSingle();
    if (!sub) throw new Error("Submission not found.");
    if (!["verified", "approved", "auto_approved"].includes(String((sub as { status?: string }).status))) {
      throw new Error("Only completed submissions can be reviewed.");
    }

    const { data: task } = await s
      .from("tasks")
      .select("created_by")
      .eq("id", (sub as { task_id: string }).task_id)
      .maybeSingle();
    const advertiserId = String((task as { created_by?: string } | null)?.created_by ?? "");
    const workerId = String((sub as { user_id: string }).user_id);

    if (opts.role === "worker" && opts.raterUserId !== workerId) {
      throw new Error("Only the worker can leave the worker review.");
    }
    if (opts.role === "advertiser" && opts.raterUserId !== advertiserId) {
      throw new Error("Only the campaign owner can leave the advertiser review.");
    }

    await (s as any).from("dual_reviews").upsert(
      {
        submission_id: opts.submissionId,
        rater_id: opts.raterUserId,
        role: opts.role,
        stars,
        comment: (opts.comment ?? "").trim().slice(0, 500) || null,
        created_at: new Date().toISOString(),
      },
      { onConflict: "submission_id,role" },
    );

    const { data: both } = await (s as any)
      .from("dual_reviews")
      .select("id, role")
      .eq("submission_id", opts.submissionId);
    const roles = new Set((both ?? []).map((r: { role: string }) => r.role));
    const revealed = roles.has("worker") && roles.has("advertiser");
    if (revealed) {
      await (s as any)
        .from("dual_reviews")
        .update({ revealed: true, revealed_at: new Date().toISOString() })
        .eq("submission_id", opts.submissionId);
    }
    return { ok: true, revealed };
  } catch (e) {
    if (e instanceof Error) throw e;
    return { ok: false, revealed: false };
  }
}

export const postDualReview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      submissionId: string;
      role: "worker" | "advertiser";
      stars: number;
      comment?: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    return submitDualReview({
      submissionId: data.submissionId,
      raterUserId: context.userId,
      role: data.role,
      stars: data.stars,
      comment: data.comment,
    });
  });
