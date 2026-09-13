/**
 * Server-only operational rules for TASKORA.
 * Tunable constants — later move to owner_settings table.
 */

export const RULES = {
  minWithdrawalUsd: 10,
  /** Hours after account creation before first withdrawal is allowed */
  newAccountWithdrawHoldHours: 24,
  /** Max task submissions per user in a rolling window */
  maxSubmissionsPerHour: 12,
  submissionWindowMs: 60 * 60 * 1000,
  referralRate: 0.08,
  dailyCheckinUsd: 0.1,
} as const;

export function hoursSince(iso: string | null | undefined): number {
  if (!iso) return 9999;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return 9999;
  return (Date.now() - t) / (1000 * 60 * 60);
}
