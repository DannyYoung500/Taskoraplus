import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AutoResult = {
  ok: boolean;
  method: "telegram_membership" | "discord_membership" | "youtube_watch" | "unsupported";
  reason?: string;
  externalStatus?: string | null;
};

function taskMetadata(task: any): Record<string, any> {
  return (task?.task_metadata && typeof task.task_metadata === "object" ? task.task_metadata : {}) as Record<string, any>;
}

function platformOf(task: any) {
  return String(task?.platform || "").toLowerCase();
}
function typeOf(task: any) {
  return String(task?.task_type || "").toLowerCase();
}
function proofOf(task: any) {
  return String(task?.proof || "").toLowerCase();
}

/** Telegram auto = proof auto/automatic OR join/subscribe/bot_start task types */
function isTelegramJoin(task: any) {
  if (platformOf(task) !== "telegram") return false;
  const t = typeOf(task);
  const p = proofOf(task);
  if (p === "auto" || p === "automatic") return true;
  return ["join", "subscribe", "bot_start", "start"].some((k) => t.includes(k));
}

function isDiscordJoin(task: any) {
  if (platformOf(task) !== "discord") return false;
  const t = typeOf(task);
  const p = proofOf(task);
  if (p === "auto" || p === "automatic") return true;
  return ["join", "subscribe"].some((k) => t.includes(k));
}

function isYoutubeWatch(task: any) {
  return (
    platformOf(task) === "youtube" &&
    (typeOf(task).includes("video_watch") ||
      typeOf(task).includes("watch") ||
      proofOf(task) === "auto")
  );
}

export function supportsAutomaticVerification(task: any): boolean {
  return isTelegramJoin(task) || isDiscordJoin(task) || isYoutubeWatch(task);
}

function botTokenTelegram(): string | null {
  const t =
    process.env["TELEGRAM_BOT_TOKEN"] ||
    process.env["BOT_TOKEN"] ||
    process.env["TG_BOT_TOKEN"] ||
    "";
  return t.trim() || null;
}

function telegramTarget(link: string): string {
  const raw = String(link || "").trim();
  if (!raw) throw new Error("This task has no Telegram link.");
  if (/^-?\d{5,}$/.test(raw)) return raw;
  if (/^@[A-Za-z0-9_]{4,}$/.test(raw)) return raw;
  const cPath = raw.match(/t\.me\/c\/(\d+)/i);
  if (cPath) return `-100${cPath[1]}`;
  const m = raw.match(/(?:t\.me|telegram\.me)\/([A-Za-z0-9_]{4,})/i);
  if (m && !["joinchat", "addstickers", "share", "proxy", "socks"].includes(m[1].toLowerCase())) {
    return `@${m[1]}`;
  }
  if (/t\.me\/(\+|joinchat\/)/i.test(raw)) {
    throw new Error(
      "Private invite links cannot be auto-verified unless the TASKORA bot is already an admin in that chat. Use Screenshot verification, or add the bot as admin and use a public @username link.",
    );
  }
  throw new Error(
    "Automatic Telegram verification needs a public @channel username or numeric chat ID. Use Screenshot verification for private invites.",
  );
}

function discordInviteCode(link: string): string {
  const raw = String(link || "").trim();
  const m = raw.match(/discord(?:\.gg|app\.com\/invite|\.com\/invite)\/([A-Za-z0-9-]+)/i);
  if (!m) {
    throw new Error(
      "Automatic Discord verification requires an invite URL such as discord.gg/example. Use Screenshot verification otherwise.",
    );
  }
  return m[1];
}

async function verifyTelegram(userId: string, task: any): Promise<AutoResult> {
  const token = botTokenTelegram();
  if (!token) {
    return {
      ok: false,
      method: "telegram_membership",
      reason: "Telegram auto-verify is not configured (BOT_TOKEN / TELEGRAM_BOT_TOKEN missing).",
    };
  }
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("telegram_id")
    .eq("id", userId)
    .maybeSingle();
  const telegramUserId = Number((profile as { telegram_id?: number | string } | null)?.telegram_id || 0);
  if (!telegramUserId) {
    return {
      ok: false,
      method: "telegram_membership",
      reason: "Your Telegram ID is missing from your profile. Re-open the Mini App from Telegram and try again.",
    };
  }
  let target: string;
  try {
    target = telegramTarget(String(task.link || task.target_url || ""));
  } catch (e) {
    return {
      ok: false,
      method: "telegram_membership",
      reason: e instanceof Error ? e.message : "Invalid Telegram link",
    };
  }
  try {
    const response = await fetch(
      `https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(target)}&user_id=${encodeURIComponent(String(telegramUserId))}`,
      { signal: AbortSignal.timeout(12_000) },
    );
    const body = (await response.json()) as {
      ok?: boolean;
      result?: { status?: string; is_member?: boolean };
      description?: string;
      error_code?: number;
    };
    if (!response.ok || !body.ok) {
      const desc = body.description || "Telegram membership check failed.";
      if (body.error_code === 400 || /chat not found|bot was kicked|not enough rights/i.test(desc)) {
        return {
          ok: false,
          method: "telegram_membership",
          reason:
            "Bot cannot see this channel yet. Advertiser must add the TASKORA bot as admin (or use a public @username). Try again after joining, or use screenshot if configured.",
        };
      }
      return { ok: false, method: "telegram_membership", reason: desc };
    }
    const status = String(body.result?.status || "").toLowerCase();
    const member =
      ["creator", "administrator", "member", "restricted"].includes(status) ||
      body.result?.is_member === true;
    return member
      ? { ok: true, method: "telegram_membership", externalStatus: status }
      : {
          ok: false,
          method: "telegram_membership",
          externalStatus: status,
          reason: "You are not a member of the required Telegram channel/group yet. Open the link, join, then Verify again.",
        };
  } catch {
    return {
      ok: false,
      method: "telegram_membership",
      reason: "Could not reach Telegram right now. Wait a few seconds and try Verify again.",
    };
  }
}

async function verifyDiscord(userId: string, task: any): Promise<AutoResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: account } = await supabaseAdmin
    .from("connected_accounts")
    .select("external_id,status")
    .eq("user_id", userId)
    .ilike("platform", "discord")
    .maybeSingle();
  if (!account?.external_id) {
    return {
      ok: false,
      method: "discord_membership",
      reason: "Connect your Discord account in Connected Accounts before verifying this task.",
    };
  }
  const { resolveDiscordBotToken } = await import("@/lib/platform-tokens");
  const token = (await resolveDiscordBotToken()) || "";
  if (!token.trim()) {
    return {
      ok: false,
      method: "discord_membership",
      reason:
        "Discord auto-verify needs a bot token. Owner: set DISCORD_BOT_TOKEN in env or paste it in Owner → Settings → Platforms. Bot must be invited to the server.",
    };
  }
  let code: string;
  try {
    code = discordInviteCode(String(task.link || task.target_url || ""));
  } catch (e) {
    return {
      ok: false,
      method: "discord_membership",
      reason: e instanceof Error ? e.message : "Invalid Discord invite",
    };
  }
  const headers = {
    Authorization: `Bot ${token.trim()}`,
    "Content-Type": "application/json",
    "User-Agent": "TASKORA/2.0",
  };
  try {
    const inviteResponse = await fetch(
      `https://discord.com/api/v10/invites/${encodeURIComponent(code)}?with_counts=true`,
      { headers, signal: AbortSignal.timeout(12_000) },
    );
    const invite = (await inviteResponse.json()) as {
      guild?: { id?: string };
      message?: string;
    };
    if (!inviteResponse.ok || !invite.guild?.id) {
      return {
        ok: false,
        method: "discord_membership",
        reason: invite.message || "Discord invite could not be resolved.",
      };
    }
    const memberResponse = await fetch(
      `https://discord.com/api/v10/guilds/${encodeURIComponent(invite.guild.id)}/members/${encodeURIComponent(String(account.external_id))}`,
      { headers, signal: AbortSignal.timeout(12_000) },
    );
    if (memberResponse.status === 200) {
      return { ok: true, method: "discord_membership", externalStatus: "member" };
    }
    if (memberResponse.status === 404) {
      return {
        ok: false,
        method: "discord_membership",
        externalStatus: "not_member",
        reason: "You have not joined the required Discord server yet. Join, then Verify again.",
      };
    }
    if (memberResponse.status === 401 || memberResponse.status === 403) {
      return {
        ok: false,
        method: "discord_membership",
        reason:
          "TASKORA bot cannot inspect that server (not invited / missing permissions). Advertiser must invite the bot, or use Screenshot verification.",
      };
    }
    return {
      ok: false,
      method: "discord_membership",
      reason: "Discord membership could not be confirmed. Try again shortly.",
    };
  } catch {
    return {
      ok: false,
      method: "discord_membership",
      reason: "Could not reach Discord right now. Try again in a moment.",
    };
  }
}

export async function verifyAutomaticTask(userId: string, task: any): Promise<AutoResult> {
  if (isTelegramJoin(task)) return verifyTelegram(userId, task);
  if (isDiscordJoin(task)) return verifyDiscord(userId, task);
  if (isYoutubeWatch(task)) {
    return {
      ok: false,
      method: "youtube_watch",
      reason: "Watch completion is verified by the Watch & Earn playback flow.",
    };
  }
  return {
    ok: false,
    method: "unsupported",
    reason: "This task does not support automatic verification. Use the screenshot flow.",
  };
}

export const verifyAutomaticTaskForCurrentUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { taskId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: task, error } = await supabaseAdmin
      .from("tasks")
      .select("*")
      .eq("id", data.taskId)
      .eq("is_active", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!task) throw new Error("This task is no longer available.");
    const metadata = taskMetadata(task);
    const methods = Array.isArray(metadata.verification_methods)
      ? metadata.verification_methods.map(String)
      : [];
    const proof = String((task as { proof?: string }).proof || "").toLowerCase();
    if (proof === "screenshot" || proof === "manual" || proof === "image") {
      throw new Error("This campaign selected Screenshot verification. Automatic verification is not used.");
    }
    if (methods.length && methods[0] === "screenshot") {
      throw new Error("This campaign selected Screenshot verification. Automatic verification is not used.");
    }
    return verifyAutomaticTask(context.userId, task);
  });
