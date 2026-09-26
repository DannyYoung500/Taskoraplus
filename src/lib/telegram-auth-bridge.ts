/**
 * Server-only helpers to map a validated Telegram user to a Supabase Auth session.
 * Email is synthetic (not used for login UI). Password is derived server-side from secrets.
 */

async function hmacBase64(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  const bytes = new Uint8Array(sig);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  // btoa is available in modern runtimes; fallback for edge
  if (typeof btoa === "function") return btoa(binary);
  return Buffer.from(bytes).toString("base64");
}

export function telegramSyntheticEmail(telegramId: number): string {
  return `tg_${telegramId}@users.taskora.internal`;
}

export async function telegramDerivedPassword(telegramId: number): Promise<string> {
  const secret =
    process.env["TELEGRAM_AUTH_SECRET"] ||
    process.env["TELEGRAM_BOT_TOKEN"] ||
    "taskora-dev-only-change-me";
  const digest = await hmacBase64(secret, `taskora-tg-auth:${telegramId}`);
  // Meet typical password complexity rules
  return `Tg!${digest.replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}9`;
}
