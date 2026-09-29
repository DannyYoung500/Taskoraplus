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

function isTelegramJoin(task: any) {
  return String(task?.platform || "").toLowerCase() === "telegram" &&
    String(task?.task_type || "").toLowerCase() === "join";
}

function isDiscordJoin(task: any) {
  return String(task?.platform || "").toLowerCase() === "discord" &&
    String(task?.task_type || "").toLowerCase() === "join";
}

function isYoutubeWatch(task: any) {
  return String(task?.platform || "").toLowerCase() === "youtube" &&
    (String(task?.task_type || "").toLowerCase() === "video_watch" || String(task?.proof || "").toLowerCase() === "auto");
}

export function supportsAutomaticVerification(task: any): boolean {
  return isTelegramJoin(task) || isDiscordJoin(task) || isYoutubeWatch(task);
}

function telegramTarget(link: string): string {
  const raw = String(link || "").trim();
  const m = raw.match(/^https?:\/\/(?:www\.)?t\.me\/([A-Za-z0-9_]{4,})\/?(?:\?.*)?$/i);
  if (m) return "@" + m[1];
  if (/^@[A-Za-z0-9_]{4,}$/.test(raw)) return raw;
  if (/^-100\d+$/.test(raw)) return raw;
  throw new Error("Automatic Telegram verification requires a public @channel username or Telegram channel ID. Use Screenshot verification for private invite links.");
}

function discordInviteCode(link: string): string {
  const raw = String(link || "").trim();
  const m = raw.match(/discord(?:\.gg|\.com\/invite)\/([A-Za-z0-9-]+)/i);
  if (!m) throw new Error("Automatic Discord verification requires a Discord invite URL such as discord.gg/example. Use Screenshot verification for unsupported/private invite links.");
  return m[1];
}

async function verifyTelegram(userId: string, task: any): Promise<AutoResult> {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) return { ok: false, method: "telegram_membership", reason: "Telegram automatic verification is not configured because TELEGRAM_BOT_TOKEN is missing." };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin.from("profiles").select("telegram_id").eq("id", userId).maybeSingle();
  const telegramUserId = profile?.telegram_id;
  if (!telegramUserId) throw new Error("Link your Telegram account first so membership can be checked automatically.");
  const target = telegramTarget(String(task.link || task.target_url || ""));
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(target)}&user_id=${encodeURIComponent(String(telegramUserId))}`);
    const body = await response.json() as { ok?: boolean; result?: { status?: string }; description?: string };
    if (!response.ok || !body.ok) return { ok: false, method: "telegram_membership", reason: body.description || "Telegram membership check failed." };
    const status = String(body.result?.status || "");
    const member = ["creator", "administrator", "member", "restricted"].includes(status);
    return member
      ? { ok: true, method: "telegram_membership", externalStatus: status }
      : { ok: false, method: "telegram_membership", externalStatus: status, reason: "You are not a member of the required Telegram channel/group yet." };
  } catch {
    return { ok: false, method: "telegram_membership", reason: "Telegram membership verification could not reach Telegram. The task remains unverified." };
  }
}

async function verifyDiscord(userId: string, task: any): Promise<AutoResult> {
  const token = process.env["DISCORD_BOT_TOKEN"];
  if (!token) return { ok: false, method: "discord_membership", reason: "Discord automatic verification is not configured because DISCORD_BOT_TOKEN is missing." };
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: account } = await supabaseAdmin
    .from("connected_accounts")
    .select("external_id,status")
    .eq("user_id", userId)
    .eq("platform", "discord")
    .maybeSingle();
  if (!account?.external_id || account.status !== "verified") {
    throw new Error("Connect and verify your Discord account first so server membership can be checked automatically.");
  }
  const code = discordInviteCode(String(task.link || task.target_url || ""));
  const headers = { Authorization: `Bot ${token}`, "Content-Type": "application/json", "User-Agent": "TASKORA/2.0" };
  try {
    const inviteResponse = await fetch(`https://discord.com/api/v10/invites/${encodeURIComponent(code)}?with_counts=true`, { headers });
    const invite = await inviteResponse.json() as { guild?: { id?: string }; code?: string; message?: string };
    if (!inviteResponse.ok || !invite.guild?.id) {
      return { ok: false, method: "discord_membership", reason: invite.message || "Discord invite could not be resolved. The task remains unverified." };
    }
    const memberResponse = await fetch(
      `https://discord.com/api/v10/guilds/${encodeURIComponent(invite.guild.id)}/members/${encodeURIComponent(String(account.external_id))}`,
      { headers },
    );
    if (memberResponse.status === 200) return { ok: true, method: "discord_membership", externalStatus: "member" };
    if (memberResponse.status === 404) return { ok: false, method: "discord_membership", externalStatus: "not_member", reason: "You have not joined the required Discord server yet." };
    if (memberResponse.status === 401 || memberResponse.status === 403) return { ok: false, method: "discord_membership", reason: "Discord automatic verification is unavailable because the TASKORA bot cannot inspect that server. The task remains unverified." };
    return { ok: false, method: "discord_membership", reason: "Discord membership could not be confirmed. The task remains unverified." };
  } catch {
    return { ok: false, method: "discord_membership", reason: "Discord membership verification could not reach Discord. The task remains unverified." };
  }
}

export async function verifyAutomaticTask(userId: string, task: any): Promise<AutoResult> {
  if (isTelegramJoin(task)) return verifyTelegram(userId, task);
  if (isDiscordJoin(task)) return verifyDiscord(userId, task);
  if (isYoutubeWatch(task)) return { ok: false, method: "youtube_watch", reason: "Watch completion is verified by the Watch & Earn playback flow." };
  return { ok: false, method: "unsupported", reason: "This task does not have a supported automatic verifier. Use Screenshot verification when the advertiser selected it." };
}

export const verifyAutomaticTaskForCurrentUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { taskId: string }) => d)
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: task, error } = await supabaseAdmin.from("tasks").select("*").eq("id", data.taskId).eq("is_active", true).maybeSingle();
    if (error) throw new Error(error.message);
    if (!task) throw new Error("This task is no longer available.");
    const metadata = taskMetadata(task);
    const methods = Array.isArray(metadata.verification_methods) ? metadata.verification_methods : [];
    if (methods.length && methods[0] !== "automatic") throw new Error("This campaign selected Screenshot verification. Automatic verification is not used.");
    const result = await verifyAutomaticTask(context.userId, task);
    return result;
  });
