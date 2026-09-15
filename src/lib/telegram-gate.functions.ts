import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnerTelegramId } from "@/lib/owner";
import { validateTelegramInitData } from "@/lib/telegram-initdata";

export type TelegramGateChatType = "channel" | "group" | "supergroup";

export type TelegramGateChat = {
  id: string;
  type: TelegramGateChatType;
  url: string;
  name: string;
  username?: string | null;
  description?: string | null;
  memberCount?: number | null;
  photoUrl?: string | null;
  botIsAdmin?: boolean | null;
  verified?: boolean;
  lastVerifiedAt?: string | null;
  error?: string | null;
};

export type TelegramGateSettings = {
  enabled: boolean;
  chatType: TelegramGateChatType;
  channelId: string;
  channelUrl: string;
  channelName: string;
  title: string;
  description: string;
  joinButtonText: string;
  checkButtonText: string;
  successMessage: string;
  failureMessage: string;
  checkIntervalSeconds: number;
  revokeOnLeave: boolean;
  allowAdmins: boolean;
  allowCreators: boolean;
  allowMembers: boolean;
  allowRestricted: boolean;
  requiredChats: TelegramGateChat[];
};

const DEFAULTS: TelegramGateSettings = {
  enabled: false,
  chatType: "channel",
  channelId: "",
  channelUrl: "",
  channelName: "TASKORA Community",
  title: "JOIN TASKORA COMMUNITY",
  description: "Join every required TASKORA Telegram community to unlock the Mini App.",
  joinButtonText: "JOIN TELEGRAM",
  checkButtonText: "CHECK MEMBERSHIP",
  successMessage: "Your TASKORA access has been unlocked.",
  failureMessage: "Join every required TASKORA Telegram community and try again.",
  checkIntervalSeconds: 30,
  revokeOnLeave: true,
  allowAdmins: true,
  allowCreators: true,
  allowMembers: true,
  allowRestricted: false,
  requiredChats: [],
};

/** In-memory rate limit: userId -> timestamps of checks in last 60s */
const rateBucket = new Map<string, number[]>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function rateLimitOk(userId: string): boolean {
  const now = Date.now();
  const prev = (rateBucket.get(userId) ?? []).filter((t) => now - t < RATE_WINDOW_MS);
  if (prev.length >= RATE_LIMIT) {
    rateBucket.set(userId, prev);
    return false;
  }
  prev.push(now);
  rateBucket.set(userId, prev);
  return true;
}

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function assertOwner(userId: string) {
  const s = await adminClient();
  const { data: role } = await s.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (role) return;
  const { data: p } = await s.from("profiles").select("telegram_id").eq("id", userId).maybeSingle();
  if (isOwnerTelegramId((p as { telegram_id?: number | string | null } | null)?.telegram_id ?? null)) return;
  throw new Error("Owner/admin authorization required.");
}

function chatType(v: unknown): TelegramGateChatType {
  const s = String(v ?? "channel").toLowerCase();
  if (s === "group" || s === "supergroup") return s;
  return "channel";
}

/** Normalize @username, t.me links, or numeric chat ids into a Telegram chat_id usable by Bot API. */
export function normalizeChatRef(raw: string): string {
  let s = String(raw ?? "").trim();
  if (!s) return "";
  s = s.replace(/^@+/, "");
  try {
    if (s.includes("t.me/") || s.includes("telegram.me/")) {
      const u = new URL(s.startsWith("http") ? s : `https://${s}`);
      const path = u.pathname.replace(/^\/+/, "").split("/")[0] ?? "";
      if (path.startsWith("+") || path.startsWith("joinchat")) return s; // invite links kept as-is for join URL
      if (path) return path.startsWith("-") || /^\d+$/.test(path) ? path : `@${path}`;
    }
  } catch {
    /* ignore */
  }
  if (/^-?\d+$/.test(s)) return s;
  return s.startsWith("@") ? s : `@${s}`;
}

function normalizeChats(v: unknown): TelegramGateChat[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<string>();
  const out: TelegramGateChat[] = [];
  for (const x of v as Record<string, unknown>[]) {
    const id = normalizeChatRef(String(x?.id ?? ""));
    if (!id) continue;
    const key = id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id,
      type: chatType(x?.type),
      url: String(x?.url ?? "").trim(),
      name: String(x?.name ?? x?.title ?? "").trim(),
      username: x?.username ? String(x.username) : null,
      description: x?.description ? String(x.description) : null,
      memberCount: x?.memberCount == null && x?.member_count == null ? null : Number(x.memberCount ?? x.member_count),
      photoUrl: (x?.photoUrl ?? x?.photo_url) ? String(x.photoUrl ?? x.photo_url) : null,
      botIsAdmin: x?.botIsAdmin == null && x?.bot_is_admin == null ? null : Boolean(x.botIsAdmin ?? x.bot_is_admin),
      verified: Boolean(x?.verified),
      lastVerifiedAt: (x?.lastVerifiedAt ?? x?.last_verified_at) ? String(x.lastVerifiedAt ?? x.last_verified_at) : null,
      error: x?.error ? String(x.error) : null,
    });
  }
  return out;
}

function normalize(row: Record<string, unknown> | null | undefined): TelegramGateSettings {
  let list = normalizeChats(row?.required_chats);
  if (!list.length && row?.channel_id) {
    list = [
      {
        id: String(row.channel_id),
        type: chatType(row.chat_type),
        url: String(row.channel_url ?? ""),
        name: String(row.channel_name ?? DEFAULTS.channelName),
      },
    ];
  }
  return {
    ...DEFAULTS,
    enabled: Boolean(row?.enabled),
    chatType: chatType(row?.chat_type),
    channelId: String(row?.channel_id ?? ""),
    channelUrl: String(row?.channel_url ?? ""),
    channelName: String(row?.channel_name ?? DEFAULTS.channelName),
    title: String(row?.title ?? DEFAULTS.title),
    description: String(row?.description ?? DEFAULTS.description),
    joinButtonText: String(row?.join_button_text ?? DEFAULTS.joinButtonText),
    checkButtonText: String(row?.check_button_text ?? DEFAULTS.checkButtonText),
    successMessage: String(row?.success_message ?? DEFAULTS.successMessage),
    failureMessage: String(row?.failure_message ?? DEFAULTS.failureMessage),
    checkIntervalSeconds: Math.min(300, Math.max(15, Number(row?.check_interval_seconds ?? 30))),
    revokeOnLeave: true,
    requiredChats: list,
  };
}

async function readSettings(): Promise<TelegramGateSettings> {
  try {
    const s = await adminClient();
    const { data, error } = await (s as any).from("telegram_gate_settings").select("*").eq("id", true).maybeSingle();
    if (error) return DEFAULTS;
    return normalize(data);
  } catch {
    return DEFAULTS;
  }
}

async function logEvent(x: {
  userId: string;
  telegramId: number;
  status: string;
  membershipStatus?: string | null;
  errorCode?: string | null;
  decision?: string;
  chatId?: string | null;
}) {
  try {
    const s = await adminClient();
    await (s as any).from("telegram_gate_events").insert({
      user_id: x.userId,
      telegram_id: x.telegramId,
      status: x.status,
      membership_status: x.membershipStatus ?? null,
      error_code: x.errorCode ?? x.decision ?? null,
    });
  } catch {
    /* never break auth on log failure */
  }
}

type TgResult = { ok: boolean; description?: string; result?: any; httpOk: boolean; error_code?: number };

async function tg(token: string, method: string, body: Record<string, unknown> = {}): Promise<TgResult> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
    const json = (await r.json()) as any;
    return { httpOk: r.ok, ok: Boolean(json.ok), description: json.description, result: json.result, error_code: json.error_code };
  } catch (e) {
    return {
      httpOk: false,
      ok: false,
      description: e instanceof Error ? e.message : "network_error",
    };
  }
}

async function resolvePhotoUrl(token: string, chat: any): Promise<string | null> {
  try {
    const fileId = chat?.photo?.big_file_id ?? chat?.photo?.small_file_id;
    if (!fileId) return null;
    const f = await tg(token, "getFile", { file_id: fileId });
    if (!f.ok || !f.result?.file_path) return null;
    return `https://api.telegram.org/file/bot${token}/${f.result.file_path}`;
  } catch {
    return null;
  }
}

async function enrichChat(token: string, item: TelegramGateChat, botId: number | null): Promise<TelegramGateChat> {
  const ref = normalizeChatRef(item.id);
  if (!ref) {
    return { ...item, verified: false, error: "Empty chat reference", botIsAdmin: false };
  }

  const r = await tg(token, "getChat", { chat_id: ref });
  if (!r.ok) {
    return {
      ...item,
      id: ref,
      verified: false,
      botIsAdmin: false,
      error: r.description ?? `Telegram error ${r.error_code ?? ""}`.trim(),
      lastVerifiedAt: new Date().toISOString(),
    };
  }

  const c = r.result ?? {};
  let memberCount: number | null = null;
  const cnt = await tg(token, "getChatMemberCount", { chat_id: c.id ?? ref });
  if (cnt.ok) memberCount = Number(cnt.result);

  let botIsAdmin: boolean | null = null;
  if (botId != null) {
    const me = await tg(token, "getChatMember", { chat_id: c.id ?? ref, user_id: botId });
    if (me.ok) {
      const st = String(me.result?.status ?? "");
      botIsAdmin = st === "administrator" || st === "creator";
    } else {
      botIsAdmin = false;
    }
  }

  const photoUrl = await resolvePhotoUrl(token, c);
  const username = c.username ? String(c.username) : null;
  const joinUrl =
    item.url ||
    c.invite_link ||
    (username ? `https://t.me/${username}` : "");

  return {
    id: String(c.id ?? ref),
    type: chatType(c.type),
    url: joinUrl,
    name: String(c.title ?? c.username ?? item.name ?? "Telegram chat"),
    username,
    description: c.description ? String(c.description) : null,
    memberCount,
    photoUrl,
    botIsAdmin,
    verified: true,
    lastVerifiedAt: new Date().toISOString(),
    error: botIsAdmin === false ? "Bot is not an administrator in this chat" : null,
  };
}

function membershipAllowed(status: string, isMember?: boolean): boolean {
  if (status === "creator" || status === "administrator" || status === "member") return true;
  if (status === "restricted" && isMember === true) return true;
  return false;
}

export const getTelegramGateSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    return readSettings();
  });

export const saveTelegramGateSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: TelegramGateSettings) => data)
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const s = await adminClient();
    let list = normalizeChats(data.requiredChats);
    if (!list.length && data.channelId.trim()) {
      list = [
        {
          id: normalizeChatRef(data.channelId),
          type: chatType(data.chatType),
          url: data.channelUrl.trim(),
          name: data.channelName.trim() || DEFAULTS.channelName,
        },
      ];
    }
    if (data.enabled && !list.length) {
      throw new Error("Add at least one Telegram channel or group before enabling the gate.");
    }
    // Block enabling if any chat failed bot-admin when verified
    if (data.enabled) {
      const bad = list.find((c) => c.verified && c.botIsAdmin === false);
      if (bad) {
        throw new Error(
          `Cannot enable gate: bot is not admin in "${bad.name || bad.id}". Add the bot as administrator and Verify again.`,
        );
      }
    }
    const first = list[0];
    const payload = {
      id: true,
      enabled: Boolean(data.enabled),
      chat_type: first?.type ?? "channel",
      channel_id: first?.id ?? null,
      channel_url: first?.url ?? null,
      channel_name: first?.name ?? DEFAULTS.channelName,
      title: data.title.trim() || DEFAULTS.title,
      description: data.description.trim() || DEFAULTS.description,
      join_button_text: data.joinButtonText.trim() || DEFAULTS.joinButtonText,
      check_button_text: data.checkButtonText.trim() || DEFAULTS.checkButtonText,
      success_message: data.successMessage.trim() || DEFAULTS.successMessage,
      failure_message: data.failureMessage.trim() || DEFAULTS.failureMessage,
      check_interval_seconds: Math.min(300, Math.max(15, Math.floor(Number(data.checkIntervalSeconds) || 30))),
      revoke_on_leave: true,
      allow_admins: true,
      allow_creators: true,
      allow_members: true,
      allow_restricted: false,
      required_chats: list,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    };
    const { error } = await (s as any).from("telegram_gate_settings").upsert(payload, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return normalize(payload);
  });

/** Owner: resolve real Telegram data for one or more chats (photo, members, bot admin). */
export const previewTelegramGateChats = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { chats: TelegramGateChat[] }) => data)
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const token = process.env.TELEGRAM_BOT_TOKEN ?? "";
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured on the server.");

    const me = await tg(token, "getMe", {});
    if (!me.ok) throw new Error(me.description ?? "Bot token rejected by Telegram.");
    const botId = Number(me.result?.id ?? 0) || null;

    const out: TelegramGateChat[] = [];
    for (const item of normalizeChats(data.chats)) {
      out.push(await enrichChat(token, item, botId));
    }
    return out;
  });

/** Owner: full health test of bot + every required chat. */
export const testTelegramGateConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const settings = await readSettings();
    const token = process.env.TELEGRAM_BOT_TOKEN ?? "";
    if (!token) {
      return { ok: false as const, error: "TELEGRAM_BOT_TOKEN is not configured on the server.", checks: [] as any[] };
    }

    const checks: Array<{ name: string; ok: boolean; detail: string }> = [];
    const me = await tg(token, "getMe", {});
    if (!me.ok) {
      return {
        ok: false as const,
        error: me.description ?? "Bot token rejected by Telegram.",
        checks: [{ name: "Bot token", ok: false, detail: me.description ?? "invalid" }],
      };
    }
    checks.push({ name: "Bot token", ok: true, detail: `@${me.result?.username ?? "bot"}` });
    const botId = Number(me.result?.id ?? 0) || null;

    if (!settings.requiredChats.length) {
      checks.push({ name: "Required chats", ok: false, detail: "None configured" });
      return { ok: false as const, botUsername: me.result?.username ?? null, checks, error: "No required chats configured." };
    }

    const chats: TelegramGateChat[] = [];
    for (const chat of settings.requiredChats) {
      const enriched = await enrichChat(token, chat, botId);
      chats.push(enriched);
      const label = enriched.name || enriched.id;
      if (!enriched.verified) {
        checks.push({ name: label, ok: false, detail: enriched.error ?? "Chat not found" });
      } else if (enriched.botIsAdmin === false) {
        checks.push({
          name: label,
          ok: false,
          detail: "Bot is not an administrator — membership checks will fail",
        });
      } else {
        checks.push({
          name: label,
          ok: true,
          detail: `${enriched.type.toUpperCase()} · ${enriched.memberCount == null ? "count N/A" : enriched.memberCount.toLocaleString()} · bot admin ✓`,
        });
      }
    }

    const ok = checks.every((c) => c.ok);
    return {
      ok,
      botUsername: me.result?.username ?? null,
      channelTitle: chats[0]?.name ?? settings.channelName,
      channelType: chats[0]?.type ?? settings.chatType,
      chats,
      checks,
      error: ok ? undefined : "One or more required chats failed verification. Fix bot admin access and chat IDs.",
    };
  });

export const getTelegramGateAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    try {
      const s = await adminClient();
      const { data } = await (s as any)
        .from("telegram_gate_events")
        .select("status,checked_at,membership_status,error_code")
        .order("checked_at", { ascending: false })
        .limit(500);
      const rows = (data ?? []) as any[];
      const verified = rows.filter((r) => r.status === "verified").length;
      const notMember = rows.filter((r) => r.status === "not_member").length;
      const failed = rows.filter((r) => r.status === "error").length;
      const total = rows.length;
      return {
        total,
        verified,
        notMember,
        failed,
        successRate: total ? Math.round((verified / total) * 100) : 0,
        lastVerified: rows.find((r) => r.status === "verified")?.checked_at ?? null,
        lastFailed: rows.find((r) => r.status !== "verified")?.checked_at ?? null,
        recent: rows.slice(0, 12),
      };
    } catch {
      return {
        total: 0,
        verified: 0,
        notMember: 0,
        failed: 0,
        successRate: 0,
        lastVerified: null,
        lastFailed: null,
        recent: [],
      };
    }
  });

/**
 * User membership check — server-authoritative.
 * NEVER trusts client isMember / telegramId.
 * AND logic across all required chats. Fail closed on API errors.
 */
export const getTelegramGateStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { initData: string; force?: boolean }) => data)
  .handler(async ({ data, context }) => {
    const settings = await readSettings();

    if (!settings.enabled) {
      return { allowed: true as const, configured: false as const, settings };
    }

    const token = process.env.TELEGRAM_BOT_TOKEN ?? "";
    if (!token || !settings.requiredChats.length) {
      return {
        allowed: false as const,
        configured: false as const,
        temporaryError: "Telegram Gate is not configured yet. Please contact TASKORA support.",
        settings,
      };
    }

    if (!rateLimitOk(context.userId)) {
      return {
        allowed: false as const,
        configured: true as const,
        temporaryError: "Too many membership checks. Please wait a moment and try again.",
        settings,
      };
    }

    let validated: { user: { id: number } };
    try {
      validated = await validateTelegramInitData(data.initData, token);
    } catch {
      await logEvent({
        userId: context.userId,
        telegramId: 0,
        status: "error",
        decision: "ACCESS_DENIED_INVALID_INIT_DATA",
        errorCode: "invalid_init_data",
      });
      throw new Error("Invalid Telegram session. Re-open TASKORA from Telegram.");
    }

    const telegramId = validated.user.id;
    const s = await adminClient();
    const { data: profile } = await s.from("profiles").select("telegram_id").eq("id", context.userId).maybeSingle();
    const linked = Number((profile as { telegram_id?: number | string | null } | null)?.telegram_id ?? 0);
    if (!linked || linked !== telegramId) {
      await logEvent({
        userId: context.userId,
        telegramId,
        status: "error",
        decision: "ACCESS_DENIED_TELEGRAM_ID_MISMATCH",
        errorCode: "telegram_id_mismatch",
      });
      throw new Error("Telegram account not linked. Re-open TASKORA from Telegram.");
    }

    type Row = {
      chat: TelegramGateChat;
      status: string;
      allowed: boolean;
      isError: boolean;
    };
    const results: Row[] = [];

    for (const chat of settings.requiredChats) {
      const p = await tg(token, "getChatMember", {
        chat_id: chat.id,
        user_id: telegramId,
      });

      if (!p.ok || !p.result?.status) {
        results.push({ chat, status: "error", allowed: false, isError: true });
        continue;
      }

      const status = String(p.result.status);
      const allowed = membershipAllowed(status, p.result.is_member === true);
      results.push({ chat, status, allowed, isError: false });
    }

    // Prefer explicit not-member over transient API errors for messaging
    const denied = results.find((x) => !x.allowed && !x.isError);
    const transient = results.some((x) => x.isError);

    if (denied) {
      await logEvent({
        userId: context.userId,
        telegramId,
        status: "not_member",
        membershipStatus: denied.status,
        decision:
          denied.status === "kicked" || denied.status === "left"
            ? "ACCESS_DENIED_NOT_MEMBER"
            : "ACCESS_DENIED_NOT_MEMBER",
        chatId: denied.chat.id,
        errorCode: denied.chat.id,
      });
      return {
        allowed: false as const,
        configured: true as const,
        settings,
        failedChat: denied.chat,
        membershipStatus: denied.status,
        checkedChats: results.map((x) => ({
          id: x.chat.id,
          name: x.chat.name,
          url: x.chat.url,
          status: x.status,
          allowed: x.allowed,
          photoUrl: x.chat.photoUrl ?? null,
        })),
      };
    }

    if (transient) {
      await logEvent({
        userId: context.userId,
        telegramId,
        status: "error",
        decision: "ACCESS_DENIED_TELEGRAM_API_ERROR",
        errorCode: "telegram_membership_check_failed",
      });
      return {
        allowed: false as const,
        configured: true as const,
        temporaryError:
          "Membership verification temporarily unavailable. We couldn't verify your Telegram membership. Please try again shortly.",
        settings,
        checkedChats: results.map((x) => ({
          id: x.chat.id,
          name: x.chat.name,
          url: x.chat.url,
          status: x.status,
          allowed: x.allowed,
          photoUrl: x.chat.photoUrl ?? null,
        })),
      };
    }

    await logEvent({
      userId: context.userId,
      telegramId,
      status: "verified",
      membershipStatus: "member",
      decision: "ACCESS_GRANTED",
    });

    return {
      allowed: true as const,
      configured: true as const,
      settings,
      checkedChats: results.map((x) => ({
        id: x.chat.id,
        name: x.chat.name,
        url: x.chat.url,
        status: x.status,
        allowed: x.allowed,
        photoUrl: x.chat.photoUrl ?? null,
      })),
    };
  });
