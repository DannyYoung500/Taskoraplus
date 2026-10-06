/**
 * Strong Score — composite fraud score 0–100, referral same-device lock,
 * task dwell-time gate. Server-only; soft-fail when optional columns missing.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type FraudScoreResult = {
  score: number;
  signals: string[];
  action: "allow" | "dual" | "hold" | "block";
};

/**
 * Composite fraud score (0 = clean, 100 = max risk).
 * Signals: low trust, high reject ratio, device cluster, brand-new account,
 * IP family velocity, missing username/photo, many pending WDs.
 */
export async function computeCompositeFraudScore(userId: string): Promise<FraudScoreResult> {
  const signals: string[] = [];
  let score = 0;

  try {
    const s = await adminClient();
    const { data: profile } = await s
      .from("profiles")
      .select(
        "trust_score, approved_count, rejected_count, device_fp, last_ip, last_ip_hint, created_at, username, photo_url, first_name, status",
      )
      .eq("id", userId)
      .maybeSingle();

    if (!profile) {
      return { score: 50, signals: ["no_profile"], action: "dual" };
    }

    const trust = Number((profile as { trust_score?: number }).trust_score ?? 70);
    if (trust < 40) {
      score += 25;
      signals.push(`low_trust:${trust}`);
    } else if (trust < 55) {
      score += 12;
      signals.push(`mid_trust:${trust}`);
    }

    const approved = Number((profile as { approved_count?: number }).approved_count ?? 0);
    const rejected = Number((profile as { rejected_count?: number }).rejected_count ?? 0);
    const total = approved + rejected;
    if (total >= 5) {
      const ratio = rejected / total;
      if (ratio >= 0.5) {
        score += 30;
        signals.push(`reject_ratio:${(ratio * 100).toFixed(0)}%`);
      } else if (ratio >= 0.3) {
        score += 15;
        signals.push(`reject_ratio:${(ratio * 100).toFixed(0)}%`);
      }
    }

    const createdAt = (profile as { created_at?: string }).created_at;
    if (createdAt) {
      const ageH = (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
      if (ageH < 24) {
        score += 20;
        signals.push("brand_new_24h");
      } else if (ageH < 72) {
        score += 10;
        signals.push("new_72h");
      }
    }

    const username = String((profile as { username?: string | null }).username ?? "").trim();
    const photo = String((profile as { photo_url?: string | null }).photo_url ?? "");
    if (!username || username.length < 3) {
      score += 8;
      signals.push("no_username");
    }
    if (!photo.startsWith("http")) {
      score += 5;
      signals.push("no_photo");
    }

    const fp = String((profile as { device_fp?: string | null }).device_fp ?? "");
    if (fp.length >= 8) {
      const { count } = await s
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("device_fp", fp);
      const n = Number(count ?? 0);
      if (n >= 4) {
        score += 35;
        signals.push(`device_cluster:${n}`);
      } else if (n >= 3) {
        score += 22;
        signals.push(`device_cluster:${n}`);
      } else if (n >= 2) {
        score += 10;
        signals.push(`device_pair:${n}`);
      }
    }

    const since24 = new Date(Date.now() - 86_400_000).toISOString();
    const { count: wd24 } = await s
      .from("withdrawals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since24);
    if (Number(wd24 ?? 0) >= 3) {
      score += 12;
      signals.push(`wd_velocity:${wd24}`);
    }

    const { count: pendingWd } = await s
      .from("withdrawals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending");
    if (Number(pendingWd ?? 0) >= 2) {
      score += 8;
      signals.push(`pending_wd:${pendingWd}`);
    }

    const status = String((profile as { status?: string }).status ?? "active");
    if (status !== "active") {
      score = Math.max(score, 90);
      signals.push(`status:${status}`);
    }
  } catch {
    signals.push("score_soft_fail");
  }

  score = Math.max(0, Math.min(100, score));
  let action: FraudScoreResult["action"] = "allow";
  if (score >= 80) action = "block";
  else if (score >= 55) action = "hold";
  else if (score >= 35) action = "dual";

  return { score, signals, action };
}

/** Block or dual-approve withdrawal based on composite score. */
export async function assertFraudScoreForWithdrawal(opts: {
  userId: string;
  amount: number;
  requiresDual: boolean;
}): Promise<{ requiresDual: boolean; score: number; signals: string[] }> {
  const r = await computeCompositeFraudScore(opts.userId);
  if (r.action === "block") {
    throw new Error(
      `Withdrawal blocked (risk score ${r.score}). Contact support if this is a mistake.`,
    );
  }
  let requiresDual = opts.requiresDual;
  if (r.action === "hold" || r.action === "dual") requiresDual = true;
  if (opts.amount >= 15 && r.score >= 25) requiresDual = true;
  return { requiresDual, score: r.score, signals: r.signals };
}

/**
 * Referral same-device lock: if referee shares device_fp with referrer,
 * do not credit referral share and flag for owner.
 */
export async function assertReferralNotSameDevice(opts: {
  referrerId: string;
  refereeId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  try {
    const s = await adminClient();
    const { data: rows } = await s
      .from("profiles")
      .select("id, device_fp")
      .in("id", [opts.referrerId, opts.refereeId]);

    if (!rows || rows.length < 2) return { ok: true };

    const fps = rows
      .map((r) => String((r as { device_fp?: string | null }).device_fp ?? "").trim())
      .filter((fp) => fp.length >= 8);

    if (fps.length >= 2 && fps[0] === fps[1]) {
      try {
        const { sendOwnerHtml } = await import("@/lib/notify-owner");
        await sendOwnerHtml(
          `⚠️ <b>Referral same-device</b>\nReferrer <code>${opts.referrerId.slice(0, 8)}</code>\nReferee <code>${opts.refereeId.slice(0, 8)}</code>\nfp <code>${fps[0].slice(0, 12)}…</code>\nShare blocked.`,
        );
      } catch {
        /* soft */
      }
      return { ok: false, reason: "same_device" };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

/**
 * Task dwell-time gate: reject submit if started_at → now is under minSeconds.
 * Call with the time the user opened/started the task (client or server stamp).
 */
export async function assertTaskDwellTime(opts: {
  startedAtIso?: string | null;
  minSeconds?: number;
  platform?: string;
}): Promise<{ dwellSec: number }> {
  const platform = String(opts.platform ?? "").toLowerCase();
  let min = opts.minSeconds ?? 8;
  if (["youtube", "watch", "tiktok"].some((p) => platform.includes(p))) min = Math.max(min, 20);
  if (["telegram", "discord"].some((p) => platform.includes(p))) min = Math.max(min, 5);

  const started = opts.startedAtIso ? new Date(opts.startedAtIso).getTime() : 0;
  if (!started || Number.isNaN(started)) {
    return { dwellSec: 0 };
  }
  const dwellSec = Math.floor((Date.now() - started) / 1000);
  if (dwellSec < min) {
    throw new Error(
      `Please spend at least ${min} seconds on this task before submitting (you had ${dwellSec}s).`,
    );
  }
  return { dwellSec };
}

export const ownerGetFraudScore = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    const { assertOwner } = await import("@/lib/owner-guard.server");
    await assertOwner(context.userId);
    return computeCompositeFraudScore(data.userId);
  });
