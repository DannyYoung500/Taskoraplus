/**
 * Owner fortress ops — bot env probes (Telegram + Discord), Discord invite probe,
 * manual membership recheck + strong nightly triggers.
 * Safe: never returns full tokens; only reachability + partial identity.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertOwner } from "@/lib/owner-guard.server";

function tgToken(): string | null {
  const t =
    process.env["TELEGRAM_BOT_TOKEN"] ||
    process.env["BOT_TOKEN"] ||
    process.env["TG_BOT_TOKEN"] ||
    "";
  return t.trim() || null;
}

async function discordToken(): Promise<string | null> {
  const { resolveDiscordBotToken } = await import("@/lib/platform-tokens");
  return resolveDiscordBotToken();
}

function mask(s: string, keep = 4): string {
  if (s.length <= keep * 2) return "***";
  return `${s.slice(0, keep)}…${s.slice(-keep)}`;
}

export type BotEnvStatus = {
  telegram: {
    configured: boolean;
    reachable: boolean;
    username?: string | null;
    id?: number | null;
    detail: string;
  };
  discord: {
    configured: boolean;
    reachable: boolean;
    username?: string | null;
    id?: string | null;
    detail: string;
  };
  checkedAt: string;
};

export async function probeBotEnvStatusInternal(): Promise<BotEnvStatus> {
  const out: BotEnvStatus = {
    telegram: {
      configured: false,
      reachable: false,
      username: null,
      id: null,
      detail: "BOT_TOKEN / TELEGRAM_BOT_TOKEN not set",
    },
    discord: {
      configured: false,
      reachable: false,
      username: null,
      id: null,
      detail: "DISCORD_BOT_TOKEN not set",
    },
    checkedAt: new Date().toISOString(),
  };

  const tg = tgToken();
  if (tg) {
    out.telegram.configured = true;
    try {
      const r = await fetch(`https://api.telegram.org/bot${tg}/getMe`, {
        signal: AbortSignal.timeout(10_000),
      });
      const j = (await r.json()) as {
        ok?: boolean;
        result?: { id?: number; username?: string; first_name?: string };
        description?: string;
      };
      if (j.ok && j.result?.id) {
        out.telegram.reachable = true;
        out.telegram.id = j.result.id;
        out.telegram.username = j.result.username ? `@${j.result.username}` : null;
        out.telegram.detail = `OK · ${out.telegram.username || j.result.first_name || "bot"} · id ${j.result.id}`;
      } else {
        out.telegram.detail = j.description || `HTTP ${r.status} · getMe failed`;
      }
    } catch (e) {
      out.telegram.detail = e instanceof Error ? e.message : "Telegram unreachable";
    }
  }

  const dc = await discordToken();
  if (dc) {
    out.discord.configured = true;
    try {
      const r = await fetch("https://discord.com/api/v10/users/@me", {
        headers: {
          Authorization: `Bot ${dc}`,
          "User-Agent": "TASKORA/2.0",
        },
        signal: AbortSignal.timeout(10_000),
      });
      const j = (await r.json()) as {
        id?: string;
        username?: string;
        message?: string;
      };
      if (r.ok && j.id) {
        out.discord.reachable = true;
        out.discord.id = j.id;
        out.discord.username = j.username ?? null;
        out.discord.detail = `OK · ${j.username || "bot"} · id ${j.id} · token ${mask(dc)}`;
      } else {
        out.discord.detail =
          j.message ||
          (r.status === 401
            ? "Invalid DISCORD_BOT_TOKEN (401)"
            : `HTTP ${r.status} · Discord @me failed`);
      }
    } catch (e) {
      out.discord.detail = e instanceof Error ? e.message : "Discord unreachable";
    }
  }

  return out;
}

export const ownerGetBotEnvStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    return probeBotEnvStatusInternal();
  });

/** Resolve invite → guild info; optionally check whether bot is in the guild. */
export async function probeDiscordInviteInternal(inviteUrlOrCode: string): Promise<{
  ok: boolean;
  code: string;
  guildId?: string | null;
  guildName?: string | null;
  memberCount?: number | null;
  botInGuild?: boolean | null;
  detail: string;
}> {
  const raw = String(inviteUrlOrCode || "").trim();
  const m = raw.match(/discord(?:\.gg|app\.com\/invite|\.com\/invite)\/([A-Za-z0-9-]+)/i);
  const code = m ? m[1] : raw.replace(/^\/+/, "").split(/[/?#]/)[0];
  if (!code || code.length < 2) {
    return { ok: false, code: "", detail: "Provide a discord.gg/… invite or invite code." };
  }

  const token = await discordToken();
  const headers: Record<string, string> = {
    "User-Agent": "TASKORA/2.0",
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bot ${token}`;

  try {
    const r = await fetch(
      `https://discord.com/api/v10/invites/${encodeURIComponent(code)}?with_counts=true`,
      { headers, signal: AbortSignal.timeout(12_000) },
    );
    const j = (await r.json()) as {
      code?: string;
      guild?: { id?: string; name?: string };
      approximate_member_count?: number;
      message?: string;
    };
    if (!r.ok || !j.guild?.id) {
      return {
        ok: false,
        code,
        detail: j.message || `Invite resolve failed (HTTP ${r.status})`,
      };
    }

    let botInGuild: boolean | null = null;
    if (token) {
      try {
        const me = await fetch("https://discord.com/api/v10/users/@me", {
          headers: { Authorization: `Bot ${token}`, "User-Agent": "TASKORA/2.0" },
          signal: AbortSignal.timeout(8_000),
        });
        const meJ = (await me.json()) as { id?: string };
        if (me.ok && meJ.id) {
          const mem = await fetch(
            `https://discord.com/api/v10/guilds/${encodeURIComponent(j.guild.id)}/members/${encodeURIComponent(meJ.id)}`,
            {
              headers: { Authorization: `Bot ${token}`, "User-Agent": "TASKORA/2.0" },
              signal: AbortSignal.timeout(8_000),
            },
          );
          botInGuild = mem.status === 200;
        }
      } catch {
        botInGuild = null;
      }
    }

    const inHint =
      botInGuild === true
        ? " · bot IS in guild (membership checks will work)"
        : botInGuild === false
          ? " · bot NOT in guild — invite the bot or membership API will 403"
          : token
            ? " · could not confirm bot membership"
            : " · set DISCORD_BOT_TOKEN to test bot-in-guild";

    return {
      ok: true,
      code,
      guildId: j.guild.id,
      guildName: j.guild.name ?? null,
      memberCount: j.approximate_member_count ?? null,
      botInGuild,
      detail: `${j.guild.name || "guild"} · id ${j.guild.id} · ~${j.approximate_member_count ?? "?"} members${inHint}`,
    };
  } catch (e) {
    return {
      ok: false,
      code,
      detail: e instanceof Error ? e.message : "Discord unreachable",
    };
  }
}

export const ownerProbeDiscordInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { invite?: string }) => d)
  .handler(async ({ context, data }) => {
    await assertOwner(context.userId);
    return probeDiscordInviteInternal(String((data as { invite?: string })?.invite || ""));
  });

export const ownerRunMembershipRecheckNow = createServerFn({ method: "POST" })
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
    const { runMembershipRecheckInternal } = await import(
      "@/lib/strong-membership-recheck.functions"
    );
    return runMembershipRecheckInternal({
      ...(data as object),
      actorId: context.userId,
    });
  });

export const ownerRunStrongNightlyNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const { runStrongNightlySuite } = await import("@/lib/strong-fortress.functions");
    return runStrongNightlySuite();
  });
