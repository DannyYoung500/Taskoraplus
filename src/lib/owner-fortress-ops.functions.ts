/**
 * Owner fortress ops — bot env probes (Telegram + Discord), Discord invite probe,
 * manual membership recheck + strong nightly triggers.
 * Safe: never returns full tokens; only reachability + partial identity.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertOwner(userId: string) {
  const m = await import("@/lib/owner-guard-impl");
  return m.assertOwner(userId);
}

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
  try {
    return await resolveDiscordBotToken();
  } catch {
    return null;
  }
}

export type BotEnvStatus = {
  telegram: { configured: boolean; reachable: boolean; username?: string; detail: string };
  discord: { configured: boolean; reachable: boolean; detail: string };
};

export const ownerGetBotEnvStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const status: BotEnvStatus = {
      telegram: { configured: false, reachable: false, detail: "not set" },
      discord: { configured: false, reachable: false, detail: "not set" },
    };
    const tg = tgToken();
    if (tg) {
      status.telegram.configured = true;
      try {
        const r = await fetch(`https://api.telegram.org/bot${tg}/getMe`, {
          signal: AbortSignal.timeout(8000),
        });
        const j = (await r.json()) as { ok?: boolean; result?: { username?: string } };
        if (r.ok && j.ok) {
          status.telegram.reachable = true;
          status.telegram.username = j.result?.username;
          status.telegram.detail = `@${j.result?.username ?? "bot"}`;
        } else {
          status.telegram.detail = "token rejected";
        }
      } catch (e) {
        status.telegram.detail = e instanceof Error ? e.message : "unreachable";
      }
    }
    const dc = await discordToken();
    if (dc) {
      status.discord.configured = true;
      try {
        const r = await fetch("https://discord.com/api/v10/users/@me", {
          headers: { Authorization: `Bot ${dc}` },
          signal: AbortSignal.timeout(8000),
        });
        if (r.ok) {
          status.discord.reachable = true;
          status.discord.detail = "ok";
        } else {
          status.discord.detail = `HTTP ${r.status}`;
        }
      } catch (e) {
        status.discord.detail = e instanceof Error ? e.message : "unreachable";
      }
    }
    return status;
  });

export const ownerProbeDiscordInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { invite: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const code = String(data.invite || "")
      .replace(/^https?:\/\/(discord\.gg|discord\.com\/invite)\//i, "")
      .trim();
    if (!code) return { ok: false, detail: "Empty invite" };
    try {
      const r = await fetch(`https://discord.com/api/v10/invites/${code}?with_counts=true`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) return { ok: false, detail: `HTTP ${r.status}` };
      const j = (await r.json()) as { guild?: { name?: string }; approximate_member_count?: number };
      return {
        ok: true,
        detail: `${j.guild?.name ?? "server"} · ~${j.approximate_member_count ?? "?"} members`,
      };
    } catch (e) {
      return { ok: false, detail: e instanceof Error ? e.message : "failed" };
    }
  });

export const ownerRunMembershipRecheckNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { minAgeHours?: number; maxAgeHours?: number; limit?: number; platform?: string }) => d ?? {},
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { runMembershipRecheck } = await import("@/lib/strong-membership-recheck.functions");
    return runMembershipRecheck({
      minAgeHours: data.minAgeHours ?? 20,
      maxAgeHours: data.maxAgeHours ?? 72,
      limit: data.limit ?? 80,
      platform: data.platform ?? "all",
    });
  });

export const ownerRunStrongNightlyNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const { runStrongNightlySuite } = await import("@/lib/strong-fortress.functions");
    return runStrongNightlySuite();
  });
