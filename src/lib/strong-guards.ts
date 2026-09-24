/**
 * Enterprise risk / geo / velocity guards for TASKORA withdrawals & submissions.
 * Soft-fail friendly — never block owner tooling.
 */
import { RULES } from "@/lib/platform-rules";

export const STRONG = {
  /** Risk score at or above this forces dual approval even under dual threshold */
  riskForceDual: 40,
  /** Risk score at or above this auto-freezes wallet and rejects the WD request */
  riskAutoFreeze: 70,
  /** Max withdrawals requested by one user in 24h */
  maxWithdrawalsPerDay: 3,
  /** ISO country codes blocked from payouts (empty = allow all) */
  payoutCountryDeny: [] as string[],
  /** ISO country codes allowed only (empty = no allow-list) */
  payoutCountryAllow: [] as string[],
} as const;

export type PayoutPolicy = {
  risk_force_dual: number;
  risk_auto_freeze: number;
  max_withdrawals_per_day: number;
  country_deny: string[];
  country_allow: string[];
};

export const DEFAULT_PAYOUT_POLICY: PayoutPolicy = {
  risk_force_dual: STRONG.riskForceDual,
  risk_auto_freeze: STRONG.riskAutoFreeze,
  max_withdrawals_per_day: STRONG.maxWithdrawalsPerDay,
  country_deny: [...STRONG.payoutCountryDeny],
  country_allow: [...STRONG.payoutCountryAllow],
};

export async function loadPayoutPolicy(): Promise<PayoutPolicy> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "payout_policy")
      .maybeSingle();
    const v = (data?.value ?? {}) as Record<string, unknown>;
    return {
      risk_force_dual: Math.max(
        0,
        Number(v.risk_force_dual ?? DEFAULT_PAYOUT_POLICY.risk_force_dual),
      ),
      risk_auto_freeze: Math.max(
        0,
        Number(v.risk_auto_freeze ?? DEFAULT_PAYOUT_POLICY.risk_auto_freeze),
      ),
      max_withdrawals_per_day: Math.max(
        1,
        Number(v.max_withdrawals_per_day ?? DEFAULT_PAYOUT_POLICY.max_withdrawals_per_day),
      ),
      country_deny: Array.isArray(v.country_deny)
        ? (v.country_deny as string[]).map((c) => String(c).toUpperCase().slice(0, 2))
        : [...DEFAULT_PAYOUT_POLICY.country_deny],
      country_allow: Array.isArray(v.country_allow)
        ? (v.country_allow as string[]).map((c) => String(c).toUpperCase().slice(0, 2))
        : [...DEFAULT_PAYOUT_POLICY.country_allow],
    };
  } catch {
    return { ...DEFAULT_PAYOUT_POLICY };
  }
}

/** Geo + velocity + risk gates before a withdrawal is accepted. */
export async function runWithdrawalStrongGuards(opts: {
  userId: string;
  amount: number;
  requiresDual: boolean;
}): Promise<{
  requiresDual: boolean;
  riskScore: number;
  riskSignals: string[];
  blocked?: string;
  autoFrozen?: boolean;
}> {
  const policy = await loadPayoutPolicy();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const since24 = new Date(Date.now() - 86_400_000).toISOString();
  const { count: wd24 } = await supabaseAdmin
    .from("withdrawals")
    .select("id", { count: "exact", head: true })
    .eq("user_id", opts.userId)
    .gte("created_at", since24);
  if ((wd24 ?? 0) >= policy.max_withdrawals_per_day) {
    return {
      requiresDual: opts.requiresDual,
      riskScore: 0,
      riskSignals: [],
      blocked: `Max ${policy.max_withdrawals_per_day} withdrawal requests per 24h. Try again later.`,
    };
  }

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("country_code")
    .eq("id", opts.userId)
    .maybeSingle();
  const cc = String(
    (profile as { country_code?: string | null } | null)?.country_code ?? "",
  )
    .trim()
    .toUpperCase();
  if (cc && policy.country_deny.includes(cc)) {
    return {
      requiresDual: opts.requiresDual,
      riskScore: 0,
      riskSignals: [],
      blocked: `Payouts are not available from your region (${cc}).`,
    };
  }
  if (cc && policy.country_allow.length > 0 && !policy.country_allow.includes(cc)) {
    return {
      requiresDual: opts.requiresDual,
      riskScore: 0,
      riskSignals: [],
      blocked: `Payouts are limited to selected regions. Contact support if this is an error.`,
    };
  }

  let riskScore = 0;
  let riskSignals: string[] = [];
  try {
    const { computeUserRiskScore } = await import("@/lib/owner-ops.functions");
    const r = await computeUserRiskScore(opts.userId);
    riskScore = r.score;
    riskSignals = r.signals;
  } catch {
    /* soft */
  }

  let requiresDual = opts.requiresDual;
  if (riskScore >= policy.risk_force_dual) {
    requiresDual = true;
  }

  if (riskScore >= policy.risk_auto_freeze && policy.risk_auto_freeze > 0) {
    try {
      await supabaseAdmin
        .from("profiles")
        .update({
          wallet_frozen: true,
          wallet_frozen_reason: `Auto-frozen: risk score ${riskScore}`,
          wallet_frozen_at: new Date().toISOString(),
        } as never)
        .eq("id", opts.userId);
      try {
        const { sendOwnerHtml } = await import("@/lib/notify-owner");
        await sendOwnerHtml(
          `🚨 <b>Auto-freeze</b>\nUser <code>${opts.userId.slice(0, 8)}</code>\nRisk <b>${riskScore}</b>\nSignals: ${riskSignals.slice(0, 3).join(" · ") || "—"}\nWD attempt $${opts.amount.toFixed(2)}`,
        );
      } catch {
        /* */
      }
    } catch {
      /* soft */
    }
    return {
      requiresDual,
      riskScore,
      riskSignals,
      blocked: `Wallet auto-frozen due to elevated risk (score ${riskScore}). Contact support.`,
      autoFrozen: true,
    };
  }

  if (opts.amount > RULES.maxAutoWithdrawalUsd) {
    requiresDual = true;
  }

  return { requiresDual, riskScore, riskSignals };
}
