/**
 * Server-only operational rules for TASKORA.
 * Floor values — owner economy can raise mins, never go below these floors.
 */

export const RULES = {
  /** Hard floor — owner min_withdrawal_usd cannot go below this */
  minWithdrawalUsd: 3,
  /** Max single withdrawal without extra owner review flag */
  maxAutoWithdrawalUsd: 500,
  /** Hours after account creation before first withdrawal is allowed */
  newAccountWithdrawHoldHours: 24,
  /** Max pending withdrawals per user at once */
  maxPendingWithdrawals: 2,
  /** Max task submissions per user in a rolling window */
  maxSubmissionsPerHour: 12,
  submissionWindowMs: 60 * 60 * 1000,
  /** Min proof text length when proof is required */
  minProofTextChars: 8,
  referralRate: 0.08,
  dailyCheckinUsd: 0.1,
  /** Daily check-in streak bonus (Task Points) every 7 consecutive days */
  streakBonusPoints: 50,
  streakBonusDays: 7,
} as const;

export function hoursSince(iso: string | null | undefined): number {
  if (!iso) return 9999;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 9999;
  return (Date.now() - t) / (1000 * 60 * 60);
}

/** Normalize TRC20 / ERC20 style addresses for shared-wallet checks */
export function normalizeWalletAddress(addr: string): string {
  return addr.trim().toLowerCase().replace(/\s+/g, "");
}
