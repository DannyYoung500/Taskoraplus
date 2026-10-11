/**
 * Owner fortress ops: bot env status (no secrets), membership recheck, nightly suite.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertOwner } from "@/lib/owner-guard.server";

function maskHint(value: string | undefined): string {
  const v = String(value || "").trim();
  if (!v) return "missing";
  if (v.length < 12) return "set";
  return `set · …${v.slice(-4)}`;
}

/** Safe status for owner UI — never returns raw tokens. */
export const ownerGetBotEnvStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const tg =
      process.env["TELEGRAM_BOT_TOKEN"] ||
      process.env["BOT_TOKEN"] ||
      process.env["TG_BOT_TOKEN"] ||
      "";
    const discord = process.env["DISCORD_BOT_TOKEN"] || "";
    const cron =
      process.env["CRON_SECRET"] || process.env["TASKORA_CRON_SECRET"] || "";

    let telegramBotOk: boolean | null = null;
    let telegramBotUsername: string | null = null;
    if (tg.trim()) {
      try {
        const r = await fetch(`https://api.telegram.org/bot${tg.trim()}/getMe`, {
          signal: AbortSignal.timeout(8_000),
        });
        const j = (await r.json()) as { ok?: boolean; result?: { username?: string } };
        telegramBotOk = Boolean(j.ok);
        telegramBotUsername = j.result?.username ? `@${j.result.username}` : null;
      } catch {
        telegramBotOk = false;
      }
    }

    let discordBotOk: boolean | null = null;
    let discordBotUsername: string | null = null;
    if (discord.trim()) {
      try {
        const r = await fetch("https://discord.com/api/v10/users/@me", {
          headers: {
            Authorization: `Bot ${discord.trim()}`,
            "User-Agent": "TASKORA/2.0",
          },
          signal: AbortSignal.timeout(8_000),
        });
        if (r.status === 200) {
          const j = (await r.json()) as { username?: string };
          discordBotOk = true;
          discordBotUsername = j.username || null;
        } else {
          discordBotOk = false;
        }
      } catch {
        discordBotOk = false;
      }
    }

    return {
      telegram: {
        configured: Boolean(tg.trim()),
        hint: maskHint(tg),
        reachable: telegramBotOk,
        username: telegramBotUsername,
      },
      discord: {
        configured: Boolean(discord.trim()),
        hint: maskHint(discord),
        reachable: discordBotOk,
        username: discordBotUsername,
        note: discord.trim()
          ? "Bot must be invited to each advertiser server with View Members for auto-verify."
          : "Add DISCORD_BOT_TOKEN on Vercel to enable Discord auto membership checks.",
      },
      cron: {
        configured: Boolean(cron.trim()),
        hint: maskHint(cron),
      },
      features: {
        telegramAutoVerify: Boolean(tg.trim()),
        discordAutoVerify: Boolean(discord.trim()),
        membershipRecheck: Boolean(tg.trim()),
        discordMembershipRecheck: Boolean(discord.trim()),
      },
    };
  });

export const ownerRunMembershipRecheckNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d?: { minAgeHours?: number; maxAgeHours?: number; limit?: number; platform?: string }) =>
      d ?? {},
  )
  .handler(async ({ context, data }) => {
    await assertOwner(context.userId);
    const { runMembershipRecheckInternal } = await import(
      "@/lib/strong-membership-recheck.functions"
    );
    return runMembershipRecheckInternal({
      minAgeHours: Number((data as { minAgeHours?: number })?.minAgeHours ?? 20),
      maxAgeHours: Number((data as { maxAgeHours?: number })?.maxAgeHours ?? 72),
      limit: Number((data as { limit?: number })?.limit ?? 100),
      actorId: context.userId,
      platform: String((data as { platform?: string })?.platform ?? "all"),
    });
  });

export const ownerRunStrongNightlyNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const { runStrongNightlySuite } = await import("@/lib/strong-fortress.functions");
    return runStrongNightlySuite();
  });

export const ownerProbeDiscordInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { inviteUrl: string; userId?: string }) => d)
  .handler(async ({ context, data }) => {
    await assertOwner(context.userId);
    const token = String(process.env["DISCORD_BOT_TOKEN"] || "").trim();
    if (!token) {
      return { ok: false as const, reason: "DISCORD_BOT_TOKEN not set on the server." };
    }
    const m = String(data.inviteUrl || "").match(
      /discord(?:\.gg|app\.com\/invite|\.com\/invite)\/([A-Za-z0-9-]+)/i,
    );
    if (!m) return { ok: false as const, reason: "Invalid invite URL." };

    const headers = {
      Authorization: `Bot ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "TASKORA/2.0",
    };
    try {
      const inviteResponse = await fetch(
        `https://discord.com/api/v10/invites/${encodeURIComponent(m[1])}?with_counts=true`,
        { headers, signal: AbortSignal.timeout(12_000) },
      );
      const invite = (await inviteResponse.json()) as {
        guild?: { id?: string; name?: string };
        approximate_member_count?: number;
        message?: string;
      };
      if (!inviteResponse.ok || !invite.guild?.id) {
        return {
          ok: false as const,
          reason: invite.message || `Invite resolve failed (${inviteResponse.status})`,
        };
      }

      let memberStatus: string | null = null;
      if (data.userId) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: account } = await supabaseAdmin
          .from("connected_accounts")
          .select("external_id")
          .eq("user_id", data.userId)
          .ilike("platform", "discord")
          .maybeSingle();
        if (account?.external_id) {
          const memberResponse = await fetch(
            `https://discord.com/api/v10/guilds/${encodeURIComponent(invite.guild.id)}/members/${encodeURIComponent(String(account.external_id))}`,
            { headers, signal: AbortSignal.timeout(12_000) },
          );
          if (memberResponse.status === 200) memberStatus = "member";
          else if (memberResponse.status === 404) memberStatus = "not_member";
          else if (memberResponse.status === 401 || memberResponse.status === 403)
            memberStatus = "bot_no_access";
          else memberStatus = `http_${memberResponse.status}`;
        } else {
          memberStatus = "user_no_connected_discord";
        }
      }

      return {
        ok: true as const,
        guildId: invite.guild.id,
        guildName: invite.guild.name ?? null,
        memberCount: invite.approximate_member_count ?? null,
        memberStatus,
        botInGuild: memberStatus !== "bot_no_access",
      };
    } catch (e) {
      return {
        ok: false as const,
        reason: e instanceof Error ? e.message : "Discord probe failed",
      };
    }
  });
