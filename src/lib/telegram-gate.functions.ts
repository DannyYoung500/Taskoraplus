import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnerTelegramId } from "@/lib/owner";
import { validateTelegramInitData } from "@/lib/telegram-initdata";

export type TelegramGateSettings = {
  enabled: boolean;
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
};

const DEFAULTS: TelegramGateSettings = {
  enabled: false,
  channelId: "",
  channelUrl: "",
  channelName: "TASKORA Community",
  title: "JOIN TASKORA COMMUNITY",
  description: "Join our official Telegram channel to unlock TASKORA and start earning.",
  joinButtonText: "JOIN TELEGRAM CHANNEL",
  checkButtonText: "CHECK MEMBERSHIP",
  successMessage: "Your TASKORA access has been unlocked.",
  failureMessage: "Please join the official TASKORA channel and try again.",
  checkIntervalSeconds: 300,
  revokeOnLeave: true,
  allowAdmins: true,
  allowCreators: true,
  allowMembers: true,
  allowRestricted: false,
};

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function assertOwner(userId: string) {
  const supabaseAdmin = await adminClient();
  const { data: role } = await supabaseAdmin.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (role) return;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("telegram_id")
    .eq("id", userId)
    .maybeSingle();
  const telegramId = (profile as { telegram_id?: number | string | null } | null)?.telegram_id;
  if (isOwnerTelegramId(telegramId ?? null)) return;
  throw new Error("Owner/admin authorization required.");
}

function normalizeSettings(row: Record<string, unknown> | null | undefined): TelegramGateSettings {
  return {
    enabled: Boolean(row?.enabled ?? DEFAULTS.enabled),
    channelId: String(row?.channel_id ?? DEFAULTS.channelId),
    channelUrl: String(row?.channel_url ?? DEFAULTS.channelUrl),
    channelName: String(row?.channel_name ?? DEFAULTS.channelName),
    title: String(row?.title ?? DEFAULTS.title),
    description: String(row?.description ?? DEFAULTS.description),
    joinButtonText: String(row?.join_button_text ?? DEFAULTS.joinButtonText),
    checkButtonText: String(row?.check_button_text ?? DEFAULTS.checkButtonText),
    successMessage: String(row?.success_message ?? DEFAULTS.successMessage),
    failureMessage: String(row?.failure_message ?? DEFAULTS.failureMessage),
    checkIntervalSeconds: Number(row?.check_interval_seconds ?? DEFAULTS.checkIntervalSeconds),
    revokeOnLeave: Boolean(row?.revoke_on_leave ?? DEFAULTS.revokeOnLeave),
    allowAdmins: Boolean(row?.allow_admins ?? DEFAULTS.allowAdmins),
    allowCreators: Boolean(row?.allow_creators ?? DEFAULTS.allowCreators),
    allowMembers: Boolean(row?.allow_members ?? DEFAULTS.allowMembers),
    allowRestricted: Boolean(row?.allow_restricted ?? DEFAULTS.allowRestricted),
  };
}

async function readSettings() {
  const supabaseAdmin = await adminClient();
  try {
    const { data, error } = await (supabaseAdmin as any)
      .from("telegram_gate_settings")
      .select("*")
      .eq("id", true)
      .maybeSingle();
    if (error) return { ...DEFAULTS };
    return normalizeSettings(data as Record<string, unknown> | null);
  } catch {
    return { ...DEFAULTS };
  }
}

async function logEvent(input: {
  userId: string;
  telegramId: number;
  status: "verified" | "not_member" | "error" | "bypassed";
  membershipStatus?: string | null;
  errorCode?: string | null;
}) {
  try {
    const supabaseAdmin = await adminClient();
    await (supabaseAdmin as any).from("telegram_gate_events").insert({
      user_id: input.userId,
      telegram_id: input.telegramId,
      status: input.status,
      membership_status: input.membershipStatus ?? null,
      error_code: input.errorCode ?? null,
    });
  } catch {
    /* table may not exist yet */
  }
}

async function isBypassed(userId: string): Promise<boolean> {
  try {
    const supabaseAdmin = await adminClient();
    const { data } = await (supabaseAdmin as any)
      .from("telegram_gate_bypass")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    return Boolean(data?.user_id);
  } catch {
    return false;
  }
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
    const supabaseAdmin = await adminClient();
    const payload = {
      id: true,
      enabled: Boolean(data.enabled),
      channel_id: data.channelId.trim() || null,
      channel_url: data.channelUrl.trim() || null,
      channel_name: data.channelName.trim() || DEFAULTS.channelName,
      title: data.title.trim() || DEFAULTS.title,
      description: data.description.trim() || DEFAULTS.description,
      join_button_text: data.joinButtonText.trim() || DEFAULTS.joinButtonText,
      check_button_text: data.checkButtonText.trim() || DEFAULTS.checkButtonText,
      success_message: data.successMessage.trim() || DEFAULTS.successMessage,
      failure_message: data.failureMessage.trim() || DEFAULTS.failureMessage,
      check_interval_seconds: Math.min(
        86400,
        Math.max(30, Math.floor(Number(data.checkIntervalSeconds) || 300)),
      ),
      revoke_on_leave: Boolean(data.revokeOnLeave),
      allow_admins: Boolean(data.allowAdmins),
      allow_creators: Boolean(data.allowCreators),
      allow_members: Boolean(data.allowMembers),
      allow_restricted: Boolean(data.allowRestricted),
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    };
    const { error } = await (supabaseAdmin as any)
      .from("telegram_gate_settings")
      .upsert(payload, { onConflict: "id" });
    if (error) throw new Error(error.message);

    try {
      await (supabaseAdmin as any).from("audit_logs").insert({
        actor_id: context.userId,
        action: "telegram_gate.settings_update",
        entity: "telegram_gate_settings",
        entity_id: "true",
        meta: {
          enabled: payload.enabled,
          channel_id: payload.channel_id,
          channel_url: payload.channel_url,
        },
      });
    } catch {
      /* optional */
    }

    return normalizeSettings(payload);
  });

export const testTelegramGateConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const settings = await readSettings();
    const botToken = process.env["TELEGRAM_BOT_TOKEN"] ?? "";
    if (!botToken) {
      return { ok: false as const, error: "TELEGRAM_BOT_TOKEN is not configured on the server." };
    }
    if (!settings.channelId) {
      return { ok: false as const, error: "Channel ID is not set in Telegram Gate settings." };
    }
    try {
      const meRes = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      const me = (await meRes.json()) as { ok?: boolean; description?: string; result?: { username?: string } };
      if (!me.ok) {
        return { ok: false as const, error: me.description ?? "Bot token rejected by Telegram." };
      }
      const chatRes = await fetch(`https://api.telegram.org/bot${botToken}/getChat`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: settings.channelId }),
      });
      const chat = (await chatRes.json()) as { ok?: boolean; description?: string; result?: { title?: string; type?: string } };
      if (!chat.ok) {
        return {
          ok: false as const,
          error:
            chat.description ??
            "Cannot read channel. Add the bot as admin in the channel and check Channel ID.",
        };
      }
      return {
        ok: true as const,
        botUsername: me.result?.username ?? null,
        channelTitle: chat.result?.title ?? settings.channelName,
        channelType: chat.result?.type ?? null,
      };
    } catch (e) {
      return {
        ok: false as const,
        error: e instanceof Error ? e.message : "Telegram API unreachable.",
      };
    }
  });

export const getTelegramGateAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    try {
      const supabaseAdmin = await adminClient();
      const { data } = await (supabaseAdmin as any)
        .from("telegram_gate_events")
        .select("status, checked_at")
        .order("checked_at", { ascending: false })
        .limit(500);
      const rows = (data ?? []) as Array<{ status: string; checked_at: string }>;
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
        lastFailed: rows.find((r) => r.status === "error" || r.status === "not_member")?.checked_at ?? null,
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
        recent: [] as Array<{ status: string; checked_at: string }>,
      };
    }
  });

export const getTelegramGateStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { initData: string; force?: boolean }) => data)
  .handler(async ({ data, context }) => {
    const settings = await readSettings();
    if (!settings.enabled) {
      return { allowed: true as const, configured: false as const, settings };
    }

    const botToken = process.env["TELEGRAM_BOT_TOKEN"] ?? "";
    if (!settings.channelId || !botToken) {
      return {
        allowed: false as const,
        configured: false as const,
        temporaryError: "Telegram gate is not configured yet. Please contact the TASKORA owner.",
        settings,
      };
    }

    const validated = await validateTelegramInitData(data.initData, botToken);
    const telegramId = validated.user.id;
    const supabaseAdmin = await adminClient();
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("telegram_id")
      .eq("id", context.userId)
      .maybeSingle();
    const profileTelegramId = Number(
      (profile as { telegram_id?: number | string | null } | null)?.telegram_id ?? 0,
    );
    if (!profileTelegramId || profileTelegramId !== telegramId) {
      throw new Error("Telegram identity mismatch. Re-open TASKORA from Telegram.");
    }

    if (isOwnerTelegramId(telegramId) || (await isBypassed(context.userId))) {
      await logEvent({
        userId: context.userId,
        telegramId,
        status: "bypassed",
        membershipStatus: "bypass",
      });
      return { allowed: true as const, configured: true as const, bypassed: true as const, settings };
    }

    if (!data.force) {
      const cutoff = new Date(Date.now() - settings.checkIntervalSeconds * 1000).toISOString();
      try {
        const { data: recent } = await (supabaseAdmin as any)
          .from("telegram_gate_events")
          .select("status,membership_status")
          .eq("user_id", context.userId)
          .eq("status", "verified")
          .gte("checked_at", cutoff)
          .order("checked_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (recent?.status === "verified") {
          return {
            allowed: true as const,
            configured: true as const,
            cached: true as const,
            membershipStatus: recent.membership_status ?? "member",
            settings,
          };
        }
      } catch {
        /* continue to live check */
      }
    }

    let response: Response;
    try {
      response = await fetch(`https://api.telegram.org/bot${botToken}/getChatMember`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: settings.channelId, user_id: telegramId }),
      });
    } catch {
      await logEvent({
        userId: context.userId,
        telegramId,
        status: "error",
        errorCode: "telegram_network",
      });
      return {
        allowed: false as const,
        configured: true as const,
        temporaryError: "Telegram membership verification is temporarily unavailable. Please try again.",
        settings,
      };
    }

    if (!response.ok) {
      await logEvent({
        userId: context.userId,
        telegramId,
        status: "error",
        errorCode: `telegram_http_${response.status}`,
      });
      return {
        allowed: false as const,
        configured: true as const,
        temporaryError: "Telegram membership verification is temporarily unavailable. Please try again.",
        settings,
      };
    }

    const payload = (await response.json()) as {
      ok?: boolean;
      description?: string;
      result?: { status?: string; is_member?: boolean };
    };

    if (!payload.ok || !payload.result?.status) {
      await logEvent({
        userId: context.userId,
        telegramId,
        status: "error",
        errorCode: payload.description ?? "telegram_api_error",
      });
      return {
        allowed: false as const,
        configured: true as const,
        temporaryError: "Telegram could not verify membership. Please try again.",
        settings,
      };
    }

    const membershipStatus = payload.result.status;
    const isAllowed =
      (membershipStatus === "creator" && settings.allowCreators) ||
      (membershipStatus === "administrator" && settings.allowAdmins) ||
      (membershipStatus === "member" && settings.allowMembers) ||
      (membershipStatus === "restricted" &&
        settings.allowRestricted &&
        payload.result.is_member === true);

    if (isAllowed) {
      await logEvent({
        userId: context.userId,
        telegramId,
        status: "verified",
        membershipStatus,
      });
      return {
        allowed: true as const,
        configured: true as const,
        membershipStatus,
        settings,
      };
    }

    await logEvent({
      userId: context.userId,
      telegramId,
      status: "not_member",
      membershipStatus,
    });
    return {
      allowed: false as const,
      configured: true as const,
      membershipStatus,
      settings,
    };
  });
