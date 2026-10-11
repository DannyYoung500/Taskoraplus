/**
 * Membership re-check (20–72h) — re-verify Telegram + Discord joins,
 * reject leavers, clawback reward, restore slot, audit_log.
 * Owner + cron call runMembershipRecheckInternal.
 * Discord path requires DISCORD_BOT_TOKEN + connected Discord account.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertOwner } from "@/lib/owner-guard.server";

async function botToken(): Promise<string | null> {
  const { resolveTelegramBotToken } = await import("@/lib/platform-tokens");
  return resolveTelegramBotToken();
}

async function discordBotToken(): Promise<string | null> {
  const { resolveDiscordBotToken } = await import("@/lib/platform-tokens");
  return resolveDiscordBotToken();
}

async function tgGetChatMember(
  token: string,
  chatId: string,
  userId: number,
): Promise<"member" | "left" | "unknown"> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/getChatMember`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, user_id: userId }),
      signal: AbortSignal.timeout(10_000),
    });
    const json = (await r.json()) as {
      ok?: boolean;
      result?: { status?: string; is_member?: boolean };
    };
    if (!json.ok) return "unknown";
    const status = String(json.result?.status || "").toLowerCase();
    if (["creator", "administrator", "member", "restricted"].includes(status)) return "member";
    if (json.result?.is_member === true) return "member";
    if (["left", "kicked"].includes(status)) return "left";
    return "unknown";
  } catch {
    return "unknown";
  }
}

function chatRefFromLink(link: string): string | null {
  const raw = String(link || "").trim();
  if (/^-?\d{5,}$/.test(raw)) return raw;
  const cPath = raw.match(/t\.me\/c\/(\d+)/i);
  if (cPath) return `-100${cPath[1]}`;
  const m = raw.match(/(?:t\.me|telegram\.me)\/([A-Za-z0-9_]{4,})/i);
  if (m && !["joinchat", "addstickers", "share", "proxy", "socks"].includes(m[1].toLowerCase())) {
    return `@${m[1]}`;
  }
  if (/^@[A-Za-z0-9_]{4,}$/.test(raw)) return raw;
  return null;
}

function discordInviteCode(link: string): string | null {
  const raw = String(link || "").trim();
  const m = raw.match(/discord(?:\.gg|app\.com\/invite|\.com\/invite)\/([A-Za-z0-9-]+)/i);
  return m ? m[1] : null;
}

/** Resolve invite → guild id, then check member. */
async function discordMemberStatus(
  token: string,
  inviteCode: string,
  discordUserId: string,
): Promise<"member" | "left" | "unknown"> {
  try {
    const headers = {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "TASKORA/2.0",
    };
    const invR = await fetch(
      `https://discord.com/api/v10/invites/${encodeURIComponent(inviteCode)}?with_counts=true`,
      { headers, signal: AbortSignal.timeout(10_000) },
    );
    const inv = (await invR.json()) as { guild?: { id?: string } };
    if (!invR.ok || !inv.guild?.id) return "unknown";

    const memR = await fetch(
      `https://discord.com/api/v10/guilds/${encodeURIComponent(inv.guild.id)}/members/${encodeURIComponent(discordUserId)}`,
      { headers, signal: AbortSignal.timeout(10_000) },
    );
    if (memR.status === 200) return "member";
    if (memR.status === 404) return "left";
    return "unknown";
  } catch {
    return "unknown";
  }
}

async function clawbackReward(opts: {
  userId: string;
  taskId: string;
  submissionId: string;
  rewardUsd: number;
}): Promise<boolean> {
  if (opts.rewardUsd <= 0) return false;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("transactions")
      .select("id")
      .eq("user_id", opts.userId)
      .eq("kind", "clawback")
      .ilike("label", `%${opts.submissionId}%`)
      .limit(1);
    if (existing && existing.length > 0) return false;

    const amount = -Math.abs(opts.rewardUsd);
    const { error } = await supabaseAdmin.from("transactions").insert({
      user_id: opts.userId,
      amount,
      kind: "clawback",
      label: `Membership leave clawback · submission ${opts.submissionId}`,
    } as never);
    if (error) {
      console.warn("[clawback]", error.message);
      return false;
    }
    try {
      const { data: task } = await supabaseAdmin
        .from("tasks")
        .select("slots_left")
        .eq("id", opts.taskId)
        .maybeSingle();
      if (task) {
        await supabaseAdmin
          .from("tasks")
          .update({
            slots_left: Number((task as { slots_left?: number }).slots_left ?? 0) + 1,
          } as never)
          .eq("id", opts.taskId);
      }
    } catch {
      /* soft */
    }
    return true;
  } catch (e) {
    console.warn("[clawback]", e);
    return false;
  }
}

function isTelegramJoinTask(task: any): boolean {
  const platform = String(task?.platform || "").toLowerCase();
  if (platform !== "telegram") return false;
  const proof = String(task?.proof || "").toLowerCase();
  const type = String(task?.task_type || "").toLowerCase();
  return (
    proof === "auto" ||
    proof === "automatic" ||
    type.includes("join") ||
    type.includes("subscribe") ||
    type.includes("bot_start") ||
    /t\.me\//i.test(String(task?.link || ""))
  );
}

function isDiscordJoinTask(task: any): boolean {
  const platform = String(task?.platform || "").toLowerCase();
  if (platform !== "discord") return false;
  const proof = String(task?.proof || "").toLowerCase();
  const type = String(task?.task_type || "").toLowerCase();
  return (
    proof === "auto" ||
    proof === "automatic" ||
    type.includes("join") ||
    type.includes("subscribe") ||
    /discord(?:\.gg|app\.com\/invite|\.com\/invite)/i.test(String(task?.link || ""))
  );
}

export async function runMembershipRecheckInternal(opts?: {
  minAgeHours?: number;
  maxAgeHours?: number;
  limit?: number;
  actorId?: string | null;
  platform?: "telegram" | "discord" | "all";
}): Promise<{
  checked: number;
  left: number;
  still: number;
  skipped: number;
  clawed: number;
  telegramChecked: number;
  discordChecked: number;
  minH: number;
  maxH: number;
  discordTokenPresent: boolean;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const token = await botToken();
  const dcToken = await discordBotToken();
  const platformFilter = (opts?.platform || "all").toLowerCase() as
    | "telegram"
    | "discord"
    | "all";

  const minH = Math.max(1, Number(opts?.minAgeHours ?? 20));
  const maxH = Math.max(minH + 1, Number(opts?.maxAgeHours ?? 72));
  const limit = Math.min(200, Math.max(1, Number(opts?.limit ?? 80)));

  const now = Date.now();
  const olderThan = new Date(now - minH * 3600_000).toISOString();
  const newerThan = new Date(now - maxH * 3600_000).toISOString();

  const { data: rows, error } = await supabaseAdmin
    .from("submissions")
    .select("id, user_id, task_id, created_at, tasks(platform, link, task_type, proof, reward)")
    .eq("status", "verified")
    .gte("created_at", newerThan)
    .lte("created_at", olderThan)
    .limit(limit);

  if (error) throw new Error(error.message);

  let checked = 0;
  let left = 0;
  let still = 0;
  let skipped = 0;
  let clawed = 0;
  let telegramChecked = 0;
  let discordChecked = 0;

  for (const row of rows ?? []) {
    const task = (row as { tasks?: any }).tasks;
    const platform = String(task?.platform || "").toLowerCase();
    const wantTg =
      (platformFilter === "all" || platformFilter === "telegram") && isTelegramJoinTask(task);
    const wantDc =
      (platformFilter === "all" || platformFilter === "discord") && isDiscordJoinTask(task);

    if (!wantTg && !wantDc) {
      skipped += 1;
      continue;
    }

    if (wantTg) {
      if (!token) {
        skipped += 1;
        continue;
      }
      const chatRef = chatRefFromLink(String(task?.link || ""));
      if (!chatRef) {
        skipped += 1;
        continue;
      }
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("telegram_id")
        .eq("id", row.user_id)
        .maybeSingle();
      const tgId = Number((profile as { telegram_id?: number } | null)?.telegram_id || 0);
      if (!tgId) {
        skipped += 1;
        continue;
      }

      checked += 1;
      telegramChecked += 1;
      const status = await tgGetChatMember(token, chatRef, tgId);
      if (status === "left") {
        left += 1;
        await supabaseAdmin
          .from("submissions")
          .update({
            status: "rejected",
            review_note: `Membership re-check (Telegram): left channel/group within ${minH}–${maxH}h window`,
          } as never)
          .eq("id", row.id);

        const rewardUsd = Number(task?.reward ?? 0);
        const didClaw = await clawbackReward({
          userId: String(row.user_id),
          taskId: String(row.task_id),
          submissionId: String(row.id),
          rewardUsd,
        });
        if (didClaw) clawed += 1;

        try {
          await supabaseAdmin.from("audit_log").insert({
            actor_id: opts?.actorId ?? null,
            action: "membership_recheck_reject",
            target_id: row.id,
            meta: {
              platform: "telegram",
              user_id: row.user_id,
              task_id: row.task_id,
              chat: chatRef,
              clawback: didClaw,
              reward: rewardUsd,
            },
          } as never);
        } catch {
          /* soft */
        }
      } else if (status === "member") {
        still += 1;
      } else {
        skipped += 1;
      }
      continue;
    }

    if (wantDc) {
      if (!dcToken) {
        skipped += 1;
        continue;
      }
      const code = discordInviteCode(String(task?.link || ""));
      if (!code) {
        skipped += 1;
        continue;
      }

      const { data: account } = await supabaseAdmin
        .from("connected_accounts")
        .select("external_id,status")
        .eq("user_id", row.user_id)
        .ilike("platform", "discord")
        .maybeSingle();

      const discordUserId = String(
        (account as { external_id?: string } | null)?.external_id || "",
      ).trim();
      if (!discordUserId) {
        skipped += 1;
        continue;
      }

      checked += 1;
      discordChecked += 1;
      const status = await discordMemberStatus(dcToken, code, discordUserId);
      if (status === "left") {
        left += 1;
        await supabaseAdmin
          .from("submissions")
          .update({
            status: "rejected",
            review_note: `Membership re-check (Discord): left server within ${minH}–${maxH}h window`,
          } as never)
          .eq("id", row.id);

        const rewardUsd = Number(task?.reward ?? 0);
        const didClaw = await clawbackReward({
          userId: String(row.user_id),
          taskId: String(row.task_id),
          submissionId: String(row.id),
          rewardUsd,
        });
        if (didClaw) clawed += 1;

        try {
          await supabaseAdmin.from("audit_log").insert({
            actor_id: opts?.actorId ?? null,
            action: "membership_recheck_reject",
            target_id: row.id,
            meta: {
              platform: "discord",
              user_id: row.user_id,
              task_id: row.task_id,
              invite: code,
              discord_user: discordUserId,
              clawback: didClaw,
              reward: rewardUsd,
            },
          } as never);
        } catch {
          /* soft */
        }
      } else if (status === "member") {
        still += 1;
      } else {
        skipped += 1;
      }
    }
  }

  return {
    checked,
    left,
    still,
    skipped,
    clawed,
    telegramChecked,
    discordChecked,
    minH,
    maxH,
    discordTokenPresent: Boolean(dcToken),
  };
}

export const ownerRunMembershipRecheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d?: {
      minAgeHours?: number;
      maxAgeHours?: number;
      limit?: number;
      platform?: "telegram" | "discord" | "all";
    }) => d ?? {},
  )
  .handler(async ({ context, data }) => {
    await assertOwner(context.userId);
    return runMembershipRecheckInternal({
      ...(data as object),
      actorId: context.userId,
    });
  });
