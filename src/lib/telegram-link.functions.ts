/**
 * Server: Telegram link preview + strong type checks via Bot API getChat.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  parseTelegramLink,
  assertTelegramLinkForService,
  normalizeTelegramUrl,
  type TelegramChatPreview,
  type ParsedTelegramLink,
} from "@/lib/telegram-link";

async function botToken(): Promise<string | null> {
  const t =
    process.env["BOT_TOKEN"] ||
    process.env["TELEGRAM_BOT_TOKEN"] ||
    process.env["TG_BOT_TOKEN"] ||
    "";
  return t.trim() || null;
}

async function tg(
  token: string,
  method: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; description?: string; result?: any }> {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(12_000),
    });
    const json = (await r.json()) as any;
    return { ok: Boolean(json.ok), description: json.description, result: json.result };
  } catch (e) {
    return { ok: false, description: e instanceof Error ? e.message : "network_error" };
  }
}

function mapType(t: string | undefined): TelegramChatPreview["type"] {
  const s = String(t || "").toLowerCase();
  if (s === "channel") return "channel";
  if (s === "supergroup") return "supergroup";
  if (s === "group") return "group";
  if (s === "private") return "private";
  return "unknown";
}

export async function resolveTelegramChatPreview(
  rawUrl: string,
): Promise<TelegramChatPreview & { parsed: ParsedTelegramLink }> {
  const parsed = parseTelegramLink(rawUrl);
  const joinUrl = parsed.normalized || normalizeTelegramUrl(rawUrl);

  if (!parsed.ok) {
    return {
      ok: false,
      title: null,
      username: null,
      type: "unknown",
      description: null,
      memberCount: null,
      photoUrl: null,
      joinUrl,
      error: parsed.error,
      parsed,
    };
  }

  if (parsed.kind === "bot" || parsed.kind === "bot_start") {
    return {
      ok: true,
      title: parsed.username ? `@${parsed.username}` : "Telegram bot",
      username: parsed.username,
      type: "bot",
      description:
        parsed.startPayload != null
          ? `Start payload: ${parsed.startPayload}`
          : "Users open this bot and press Start.",
      memberCount: null,
      photoUrl: null,
      joinUrl,
      parsed,
    };
  }

  if (parsed.kind === "invite") {
    return {
      ok: true,
      title: "Private invite",
      username: null,
      type: "unknown",
      description:
        "Private channel/group invite. Bot must already be admin to auto-verify joins.",
      memberCount: null,
      photoUrl: null,
      joinUrl,
      parsed,
    };
  }

  const token = await botToken();
  if (!token || !parsed.username) {
    return {
      ok: true,
      title: parsed.username ? `@${parsed.username}` : "Telegram chat",
      username: parsed.username,
      type: "unknown",
      description: "Public link — type confirmed when bot can resolve the chat.",
      memberCount: null,
      photoUrl: null,
      joinUrl,
      parsed,
    };
  }

  const ref = `@${parsed.username}`;
  const r = await tg(token, "getChat", { chat_id: ref });
  if (!r.ok || !r.result) {
    return {
      ok: false,
      title: null,
      username: parsed.username,
      type: "unknown",
      description: null,
      memberCount: null,
      photoUrl: null,
      joinUrl,
      error:
        r.description ||
        "Could not resolve this Telegram link. Check the username is public and correct.",
      parsed,
    };
  }

  const c = r.result;
  let memberCount: number | null = null;
  const cnt = await tg(token, "getChatMemberCount", { chat_id: c.id ?? ref });
  if (cnt.ok) memberCount = Number(cnt.result);

  let photoUrl: string | null = null;
  try {
    const fileId = c?.photo?.big_file_id ?? c?.photo?.small_file_id;
    if (fileId) {
      const f = await tg(token, "getFile", { file_id: fileId });
      if (f.ok && f.result?.file_path) {
        photoUrl = `https://api.telegram.org/file/bot${token}/${f.result.file_path}`;
      }
    }
  } catch {
    /* soft */
  }

  return {
    ok: true,
    title: String(c.title ?? c.username ?? parsed.username),
    username: c.username ? String(c.username) : parsed.username,
    type: mapType(c.type),
    description: c.description ? String(c.description) : null,
    memberCount,
    photoUrl,
    joinUrl: c.username ? `https://t.me/${c.username}` : joinUrl,
    parsed,
  };
}

export async function assertTelegramTargetForService(opts: {
  serviceId: string;
  link: string;
}): Promise<{ parsed: ParsedTelegramLink; preview: TelegramChatPreview }> {
  const parsed = assertTelegramLinkForService(opts.serviceId, opts.link);
  const preview = await resolveTelegramChatPreview(opts.link);

  if (opts.serviceId === "tg_members") {
    if (preview.ok && preview.type === "supergroup") {
      throw new Error(
        "This link is a Telegram group/supergroup, not a channel. Use “Telegram Group Members” instead.",
      );
    }
    if (preview.ok && preview.type === "group") {
      throw new Error(
        "This link is a Telegram group, not a channel. Use “Telegram Group Members” instead.",
      );
    }
    if (preview.ok && preview.type === "bot") {
      throw new Error("This is a bot link. Use “Telegram Bot Starts” instead.");
    }
  }

  if (opts.serviceId === "tg_group") {
    if (preview.ok && preview.type === "channel") {
      throw new Error(
        "This link is a Telegram channel, not a group. Use “Telegram Channel Members” instead.",
      );
    }
    if (preview.ok && preview.type === "bot") {
      throw new Error("This is a bot link. Use “Telegram Bot Starts” instead.");
    }
  }

  if (opts.serviceId === "tg_bot_start") {
    if (preview.type !== "bot" && parsed.kind !== "bot" && parsed.kind !== "bot_start") {
      throw new Error("Paste a bot link ending with “bot”, e.g. https://t.me/MyBot?start=ref");
    }
  }

  if (!preview.ok && preview.error && opts.serviceId !== "tg_bot_start") {
    if (parsed.kind === "channel_or_group") {
      throw new Error(preview.error);
    }
  }

  return { parsed, preview };
}

export const previewTelegramLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { url: string; serviceId?: string }) => d)
  .handler(async ({ data }) => {
    const url = String(data.url || "").trim();
    if (!url) {
      return {
        ok: false as const,
        error: "Paste a Telegram link.",
        preview: null as TelegramChatPreview | null,
        parsed: null as ParsedTelegramLink | null,
      };
    }
    if (data.serviceId) {
      try {
        const { parsed, preview } = await assertTelegramTargetForService({
          serviceId: data.serviceId,
          link: url,
        });
        return { ok: true as const, error: null as string | null, preview, parsed };
      } catch (e) {
        const parsed = parseTelegramLink(url);
        const preview = await resolveTelegramChatPreview(url);
        return {
          ok: false as const,
          error: e instanceof Error ? e.message : "Invalid Telegram link.",
          preview,
          parsed,
        };
      }
    }
    const preview = await resolveTelegramChatPreview(url);
    return {
      ok: preview.ok,
      error: preview.error ?? null,
      preview,
      parsed: preview.parsed,
    };
  });
