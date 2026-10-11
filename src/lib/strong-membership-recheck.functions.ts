/**
 * Membership re-check (20–72h) — Telegram + Discord joins.
 * Reject leavers, clawback reward, restore slot.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertOwner } from "@/lib/owner-guard.server";

async function botTokenTg(): Promise<string | null> {
  const t =
    process.env["BOT_TOKEN"] ||
    process.env["TELEGRAM_BOT_TOKEN"] ||
    process.env["TG_BOT_TOKEN"] ||
    "";
  return t.trim() || null;
}

function discordToken(): string | null {
  return String(process.env["DISCORD_BOT_TOKEN"] || "").trim() || null;
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
  const m = String(link || "").match(
    /discord(?:\.gg|app\.com\/invite|\.com\/invite)\/([A-Za-z0-9-]+)/i,
  );
  return m ? m[1] : null;
}

async function discordMemberStatus(
  token: string,
  inviteCode: string,
  discordUserId: string,
): Promise<"member" | "left" | "unknown"> {
  const headers = {
    Authorization: `Bot ${token}`,
    "Content-Type": "application/json",
    "User-Agent": "TASKORA/2.0",
  };
  try {
    const inviteResponse = await fetch(
      `https://discord.com/api/v10/invites/${encodeURIComponent(inviteCode)}?with_counts=true`,
      { headers, signal: AbortSignal.timeout(10_000) },
    );
    const invite = (await inviteResponse.json()) as { guild?: { id?: string } };
    if (!inviteResponse.ok || !invite.guild?.id) return "unknown";
    const memberResponse = await fetch(
      `https://discord.com/api/v10/guilds/${encodeURIComponent(invite.guild.id)}/members/${encodeURIComponent(discordUserId)}`,
      { headers, signal: AbortSignal.timeout(10_000) },
    );
    if (memberResponse.status === 200) return "member";
    if (memberResponse.status === 404) return "left";
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

    const { error } = await supabaseAdmin.from("transactions").insert({
      user_id: opts.userId,
      amount: -Math.abs(opts.rewardUsd),
      kind: "clawback",
      label: `Membership leave clawback · submission ${opts.submissionId}`,
    } as never);
    if (error) return false;
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
  } catch {
    return false;
  }
}

export async function runMembershipRecheckInternal(opts?: {
  minAgeHours?: number;
  maxAgeHours?: number;
  limit?: number;
  actorId?: string | null;
  platform?: string;
}): Promise<{
  checked: number;
  left: number;
  still: number;
  skipped: number;
  clawed: number;
  minH: number;
  maxH: number;
  platforms: string[];
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const tgTok = await botTokenTg();
  const dcTok = discordToken();
  const want = String(opts?.platform || "all").toLowerCase();

  if (want === "telegram" && !tgTok) throw new Error("BOT_TOKEN / TELEGRAM_BOT_TOKEN not configured");
  if (want === "discord" && !dcTok) throw new Error("DISCORD_BOT_TOKEN not configured");
  if (want === "all" && !tgTok && !dcTok) {
    throw new Error("No membership bot tokens configured");
  }

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
  const platformsUsed = new Set<string>();

  for (const row of rows ?? []) {
    const task = (row as { tasks?: any }).tasks;
    const platform = String(task?.platform || "").toLowerCase();
    const proof = String(task?.proof || "").toLowerCase();
    const type = String(task?.task_type || "").toLowerCase();
    const link = String(task?.link || "");

    const isTgJoin =
      platform === "telegram" &&
      (proof === "auto" ||
        proof === "automatic" ||
        type.includes("join") ||
        type.includes("subscribe") ||
        type.includes("bot_start") ||
        /t\.me\//i.test(link));

    const isDcJoin =
      platform === "discord" &&
      (proof === "auto" ||
        proof === "automatic" ||
        type.includes("join") ||
        type.includes("subscribe") ||
        /discord\.(gg|com)/i.test(link));

    if (want === "telegram" && !isTgJoin) {
      skipped += 1;
      continue;
    }
    if (want === "discord" && !isDcJoin) {
      skipped += 1;
      continue;
    }
    if (want === "all" && !isTgJoin && !isDcJoin) {
      skipped += 1;
      continue;
    }

    let status: "member" | "left" | "unknown" = "unknown";

    if (isTgJoin && tgTok && (want === "all" || want === "telegram")) {
      const chatRef = chatRefFromLink(link);
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
      platformsUsed.add("telegram");
      status = await tgGetChatMember(tgTok, chatRef, tgId);
    } else if (isDcJoin && dcTok && (want === "all" || want === "discord")) {
      const code = discordInviteCode(link);
      if (!code) {
        skipped += 1;
        continue;
      }
      const { data: account } = await supabaseAdmin
        .from("connected_accounts")
        .select("external_id")
        .eq("user_id", row.user_id)
        .ilike("platform", "discord")
        .maybeSingle();
      const ext = String((account as { external_id?: string } | null)?.external_id || "");
      if (!ext) {
        skipped += 1;
        continue;
      }
      checked += 1;
      platformsUsed.add("discord");
      status = await discordMemberStatus(dcTok, code, ext);
    } else {
      skipped += 1;
      continue;
    }

    if (status === "left") {
      left += 1;
      await supabaseAdmin
        .from("submissions")
        .update({
          status: "rejected",
          review_note: `Membership re-check: left within ${minH}–${maxH}h (${platform})`,
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
            user_id: row.user_id,
            task_id: row.task_id,
            platform,
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

  return {
    checked,
    left,
    still,
    skipped,
    clawed,
    minH,
    maxH,
    platforms: [...platformsUsed],
  };
}

export const ownerRunMembershipRecheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d?: {
      minAgeHours?: number;
      maxAgeHours?: number;
      limit?: number;
      platform?: string;
    }) => d ?? {},
  )
  .handler(async ({ context, data }) => {
    await assertOwner(context.userId);
    return runMembershipRecheckInternal({
      ...(data as object),
      actorId: context.userId,
    });
  });
