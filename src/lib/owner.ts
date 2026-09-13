/**
 * Owner authorization by Telegram ID.
 * Vercel: TASKORA_OWNER_TELEGRAM_IDS=123456789 or 123456789,987654321
 * Accepts optional spaces, quotes, and newlines.
 */

export function ownerTelegramIds(): number[] {
  const raw =
    process.env["TASKORA_OWNER_TELEGRAM_IDS"] ??
    process.env["OWNER_TELEGRAM_IDS"] ??
    "";
  return raw
    .replace(/["'\[\]]/g, "")
    .split(/[,\s\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isFinite(n) && n > 0);
}

export function isOwnerTelegramId(telegramId: number | string | null | undefined): boolean {
  if (telegramId === null || telegramId === undefined || telegramId === "") return false;
  const id = Number(telegramId);
  if (!Number.isFinite(id) || id <= 0) return false;
  const owners = ownerTelegramIds();
  return owners.includes(id);
}
