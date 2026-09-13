/**
 * Official Telegram WebApp initData validation (server-side only).
 * Never trust initDataUnsafe. Never ship the bot token to the client.
 *
 * Spec: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */

export type TelegramWebAppUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  is_premium?: boolean;
  photo_url?: string;
};

export type ValidatedInitData = {
  user: TelegramWebAppUser;
  authDate: number;
  queryId?: string | undefined;
  startParam?: string | undefined;
  raw: Record<string, string>;
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function hmacHex(key: ArrayBuffer | Uint8Array, message: string): Promise<string> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Validate raw initData string with the bot token.
 * Returns parsed user on success; throws on failure.
 */
export async function validateTelegramInitData(
  initData: string,
  botToken: string,
  maxAgeSeconds = 86400,
): Promise<ValidatedInitData> {
  if (!initData?.trim()) throw new Error("Missing Telegram initData.");
  if (!botToken?.trim()) throw new Error("BOT token is not configured on the server.");

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) throw new Error("initData is missing hash.");

  const pairs: string[] = [];
  params.forEach((value, key) => {
    if (key !== "hash") pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode("WebAppData"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const secretBytes = await crypto.subtle.sign(
    "HMAC",
    secretKey,
    new TextEncoder().encode(botToken),
  );
  const calculated = await hmacHex(new Uint8Array(secretBytes), dataCheckString);
  if (!timingSafeEqual(calculated, hash)) {
    throw new Error("Invalid Telegram initData signature.");
  }

  const authDate = Number(params.get("auth_date") || "0");
  if (!authDate) throw new Error("initData is missing auth_date.");
  const age = Math.floor(Date.now() / 1000) - authDate;
  if (age > maxAgeSeconds) throw new Error("Telegram initData expired. Re-open the Mini App.");

  const userRaw = params.get("user");
  if (!userRaw) throw new Error("initData has no user.");
  let user: TelegramWebAppUser;
  try {
    user = JSON.parse(userRaw) as TelegramWebAppUser;
  } catch {
    throw new Error("initData user payload is invalid JSON.");
  }
  if (!user?.id || typeof user.id !== "number") {
    throw new Error("Telegram user id is missing.");
  }

  const raw: Record<string, string> = {};
  params.forEach((value, key) => {
    raw[key] = value;
  });

  return {
    user,
    authDate,
    queryId: params.get("query_id") ?? undefined,
    startParam: params.get("start_param") ?? undefined,
    raw,
  };
}
