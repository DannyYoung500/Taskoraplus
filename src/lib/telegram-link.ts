/**
 * Telegram t.me link parser + validators (client + server safe).
 * Formats: public username, private invite (+/joinchat), bot start, message links.
 */

export type TelegramLinkKind =
  | "channel_or_group" // public @username — resolve type via API
  | "invite" // private invite link
  | "bot_start" // t.me/Bot?start=
  | "bot" // t.me/SomeBot
  | "message" // t.me/username/123 or t.me/c/...
  | "share"
  | "invalid";

export type ParsedTelegramLink = {
  ok: boolean;
  kind: TelegramLinkKind;
  raw: string;
  normalized: string;
  username: string | null;
  inviteHash: string | null;
  startPayload: string | null;
  messageId: string | null;
  error?: string;
};

const RESERVED = new Set([
  "share",
  "addstickers",
  "proxy",
  "socks",
  "setlanguage",
  "iv",
  "login",
  "confirmphone",
  "msg",
  "c",
  "s",
  "joinchat",
  "addtheme",
  "bg",
]);

/** Normalize any telegram URL to https://t.me/... */
export function normalizeTelegramUrl(raw: string): string {
  let s = String(raw || "").trim();
  if (!s) return "";
  s = s.replace(/^tg:\/\//i, "https://t.me/");
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    if (!["t.me", "telegram.me", "telegram.dog"].includes(host)) return s;
    return `https://t.me${u.pathname}${u.search}`;
  } catch {
    return s;
  }
}

export function parseTelegramLink(raw: string): ParsedTelegramLink {
  const empty: ParsedTelegramLink = {
    ok: false,
    kind: "invalid",
    raw: String(raw || ""),
    normalized: "",
    username: null,
    inviteHash: null,
    startPayload: null,
    messageId: null,
    error: "Paste a valid Telegram link (t.me/…).",
  };
  if (!raw || !String(raw).trim()) return empty;

  const normalized = normalizeTelegramUrl(raw);
  let u: URL;
  try {
    u = new URL(normalized);
  } catch {
    return { ...empty, error: "Invalid URL." };
  }

  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  if (!["t.me", "telegram.me", "telegram.dog"].includes(host)) {
    return { ...empty, error: "Link must be a Telegram (t.me) URL." };
  }

  const parts = u.pathname
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
    .split("/")
    .filter(Boolean);
  const qStart = u.searchParams.get("start") ?? u.searchParams.get("startapp");

  // Private invite: t.me/+HASH or t.me/joinchat/HASH
  if (parts[0]?.startsWith("+") || parts[0]?.toLowerCase() === "joinchat") {
    const hash = parts[0].startsWith("+")
      ? parts[0].slice(1)
      : parts[1] || "";
    if (!hash || hash.length < 4) {
      return { ...empty, normalized, error: "Invite link is incomplete." };
    }
    return {
      ok: true,
      kind: "invite",
      raw: String(raw),
      normalized: parts[0].startsWith("+")
        ? `https://t.me/+${hash}`
        : `https://t.me/joinchat/${hash}`,
      username: null,
      inviteHash: hash,
      startPayload: null,
      messageId: null,
    };
  }

  // Private channel message: t.me/c/123456/789
  if (parts[0]?.toLowerCase() === "c") {
    return {
      ok: false,
      kind: "message",
      raw: String(raw),
      normalized,
      username: null,
      inviteHash: null,
      startPayload: null,
      messageId: parts[2] || parts[1] || null,
      error: "This is a message link, not a channel/group join link. Use the channel or invite link instead.",
    };
  }

  // Share / reserved paths
  if (parts[0] && RESERVED.has(parts[0].toLowerCase())) {
    return {
      ok: false,
      kind: parts[0].toLowerCase() === "share" ? "share" : "invalid",
      raw: String(raw),
      normalized,
      username: null,
      inviteHash: null,
      startPayload: null,
      messageId: null,
      error: "This Telegram link type is not supported for tasks.",
    };
  }

  // Public username (channel, group, or bot)
  const username = parts[0] ? parts[0].replace(/^@/, "") : "";
  if (!username || !/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(username)) {
    return {
      ...empty,
      normalized,
      error: "Enter a public t.me/username, invite link (t.me/+…), or bot link.",
    };
  }

  // Message in public channel: t.me/username/123
  if (parts.length >= 2 && /^\d+$/.test(parts[1])) {
    return {
      ok: false,
      kind: "message",
      raw: String(raw),
      normalized,
      username,
      inviteHash: null,
      startPayload: null,
      messageId: parts[1],
      error: "This is a post link, not a join link. Paste the channel or group link (without /message id).",
    };
  }

  const isBotName = /bot$/i.test(username);
  if (qStart != null || isBotName) {
    return {
      ok: true,
      kind: qStart != null ? "bot_start" : "bot",
      raw: String(raw),
      normalized: qStart != null
        ? `https://t.me/${username}?start=${encodeURIComponent(qStart)}`
        : `https://t.me/${username}`,
      username,
      inviteHash: null,
      startPayload: qStart,
      messageId: null,
    };
  }

  return {
    ok: true,
    kind: "channel_or_group",
    raw: String(raw),
    normalized: `https://t.me/${username}`,
    username,
    inviteHash: null,
    startPayload: null,
    messageId: null,
  };
}

/** Validate link matches advertise service (channel / group / bot start). */
export function assertTelegramLinkForService(
  serviceId: string,
  rawUrl: string,
): ParsedTelegramLink {
  const parsed = parseTelegramLink(rawUrl);
  if (!parsed.ok) {
    throw new Error(parsed.error || "Invalid Telegram link.");
  }

  if (serviceId === "tg_members") {
    if (parsed.kind === "bot" || parsed.kind === "bot_start") {
      throw new Error("Use a channel link, not a bot link. Example: https://t.me/yourchannel");
    }
    if (parsed.kind !== "channel_or_group" && parsed.kind !== "invite") {
      throw new Error("Paste a Telegram channel link (t.me/username or t.me/+invite).");
    }
    return parsed;
  }

  if (serviceId === "tg_group") {
    if (parsed.kind === "bot" || parsed.kind === "bot_start") {
      throw new Error("Use a group link, not a bot link. Example: https://t.me/yourgroup");
    }
    if (parsed.kind !== "channel_or_group" && parsed.kind !== "invite") {
      throw new Error("Paste a Telegram group link (t.me/username or t.me/+invite).");
    }
    return parsed;
  }

  if (serviceId === "tg_bot_start") {
    if (parsed.kind !== "bot" && parsed.kind !== "bot_start") {
      throw new Error(
        "Paste a bot link. Example: https://t.me/YourBot?start=ref123 or https://t.me/YourBot",
      );
    }
    if (!parsed.username || !/bot$/i.test(parsed.username)) {
      throw new Error("Bot username should end with “bot” (Telegram BotFather rule).");
    }
    return parsed;
  }

  if (parsed.kind === "message" || parsed.kind === "share" || parsed.kind === "invalid") {
    throw new Error(parsed.error || "Unsupported Telegram link.");
  }
  return parsed;
}

export type TelegramChatPreview = {
  ok: boolean;
  title: string | null;
  username: string | null;
  type: "channel" | "group" | "supergroup" | "bot" | "private" | "unknown";
  description: string | null;
  memberCount: number | null;
  photoUrl: string | null;
  joinUrl: string;
  error?: string;
};
