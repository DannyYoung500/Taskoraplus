/**
 * Owner authorization by Telegram ID.
 * Set TASKORA_OWNER_TELEGRAM_IDS=123456789,987654321 (comma-separated).
 */

export function ownerTelegramIds(): number[] {
  const raw = process.env["TASKORA_OWNER_TELEGRAM_IDS"] ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function isOwnerTelegramId(telegramId: number | null | undefined): boolean {
  if (!telegramId) return false;
  return ownerTelegramIds().includes(Number(telegramId));
}
