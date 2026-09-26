import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validateBotWelcomePhoto } from "@/lib/bot-welcome-photo";

async function admin() {
  const m = await import("@/lib/owner-guard.server");
  return m.admin();
}

async function audit(params: Parameters<typeof import("@/lib/owner-guard.server").audit>[0]) {
  const m = await import("@/lib/owner-guard.server");
  return m.audit(params);
}

async function guard(userId: string) {
  const m = await import("@/lib/owner-guard.server");
  await m.assertOwner(userId);
  return m.admin();
}

export type WelcomeButton = {
  id: string;
  label: string;
  type: "web_app" | "url" | "callback";
  url?: string;
  path?: string;
};

const DEFAULT_MESSAGE = `✨ WELCOME TO TASKORA

Hey @username 👋
Your premium Telegram earning hub is ready.

🎯 COMPLETE — Find verified tasks and earn real rewards.
🎮 PLAY — Explore supported games and earn from eligible activity.
▶️ WATCH & EARN — Watch eligible content and earn USDT.
👥 REFER — Invite friends and earn eligible referral commission.
💰 WALLET — Track your balance, earnings and withdrawals.
⭐ RANK UP — Build Task Points and climb the leaderboard.

🔐 Secure • Telegram-native • Built for earning

Ready to get started?
Open TASKORA below. 🚀`;

const DEFAULT_BUTTONS: WelcomeButton[] = [
  { id: "open", label: "🚀 OPEN TASKORA", type: "web_app", path: "/" },
  { id: "tasks", label: "🎯 TASKS", type: "web_app", path: "/tasks" },
  { id: "watch", label: "▶️ WATCH & EARN", type: "web_app", path: "/watch-earn" },
  { id: "wallet", label: "💰 WALLET", type: "web_app", path: "/wallet" },
  { id: "referrals", label: "👥 REFERRALS", type: "web_app", path: "/profile" },
  { id: "community", label: "💬 COMMUNITY", type: "url", url: "https://t.me/Taskoraplus" },
];

function normalizeButtons(raw: unknown): WelcomeButton[] {
  if (!Array.isArray(raw)) return DEFAULT_BUTTONS;
  return raw
    .filter((b) => b && typeof b === "object" && typeof (b as WelcomeButton).label === "string")
    .map((b) => {
      const x = b as WelcomeButton;
      return {
        id: String(x.id || crypto.randomUUID().slice(0, 8)),
        label: String(x.label).slice(0, 64),
        type: x.type === "url" || x.type === "callback" ? x.type : "web_app",
        url: x.url ? String(x.url).slice(0, 512) : undefined,
        path: x.path ? String(x.path).slice(0, 128) : undefined,
      };
    });
}

function personalize(text: string, username?: string | null, firstName?: string | null) {
  const handle = username ? `@${username.replace(/^@/, "")}` : firstName || "friend";
  return text.replace(/@username/gi, handle);
}

type TgBtn =
  | { text: string; web_app: { url: string } }
  | { text: string; url: string }
  | { text: string; callback_data: string };

function buildInlineKeyboard(
  buttons: WelcomeButton[],
  miniAppUrl: string | null,
  communityUrl: string,
) {
  const base = (miniAppUrl || "").replace(/\/$/, "");
  const rows: TgBtn[][] = [];
  let row: TgBtn[] = [];
  for (const b of buttons) {
    let btn: TgBtn | null = null;
    if (b.type === "web_app") {
      const path = b.path ? (b.path.startsWith("/") ? b.path : `/${b.path}`) : "";
      const url = b.url || (base ? `${base}${path}` : "") || base;
      if (url) btn = { text: b.label, web_app: { url } };
    } else if (b.type === "url") {
      const url = b.url || (b.id === "community" ? communityUrl : "");
      if (url) btn = { text: b.label, url };
    } else if (b.type === "callback" && b.id) {
      btn = { text: b.label, callback_data: b.id.slice(0, 64) };
    }
    if (!btn) continue;
    if (b.id === "open") {
      if (row.length) {
        rows.push(row);
        row = [];
      }
      rows.push([btn]);
      continue;
    }
    row.push(btn);
    if (row.length >= 2) {
      rows.push(row);
      row = [];
    }
  }
  if (row.length) rows.push(row);
  return { inline_keyboard: rows };
}

async function tg(method: string, body: Record<string, unknown>) {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = (await r.json()) as { ok: boolean; description?: string; result?: unknown };
  if (!j.ok) throw new Error(j.description || `Telegram ${method} failed`);
  return j.result;
}

export async function sendWelcomeToChat(opts: {
  chatId: number | string;
  username?: string | null;
  firstName?: string | null;
  useDraft?: boolean;
}) {
  const db = await admin();
  const { data } = await db.from("bot_welcome_settings").select("*").eq("id", true).maybeSingle();
  let message = DEFAULT_MESSAGE;
  let buttons = DEFAULT_BUTTONS;
  let photoUrl: string | null = null;
  let photoFileId: string | null = null;
  let community = "https://t.me/Taskoraplus";
  let mini = process.env["MINI_APP_URL"] || process.env["VITE_MINI_APP_URL"] || null;

  if (data) {
    if (opts.useDraft) {
      message = (data.draft_message_text as string) || (data.message_text as string) || message;
      buttons = normalizeButtons(data.draft_buttons ?? data.buttons);
      photoUrl = (data.draft_photo_url as string | null) ?? (data.photo_url as string | null);
      photoFileId = (data.draft_photo_file_id as string | null) ?? (data.photo_file_id as string | null);
      community = (data.draft_community_url as string) || (data.community_url as string) || community;
      mini = (data.draft_mini_app_url as string | null) || (data.mini_app_url as string | null) || mini;
    } else {
      message = (data.message_text as string) || message;
      buttons = normalizeButtons(data.buttons);
      photoUrl = data.photo_url as string | null;
      photoFileId = data.photo_file_id as string | null;
      community = (data.community_url as string) || community;
      mini = (data.mini_app_url as string | null) || mini;
    }
    if (data.enabled === false && !opts.useDraft) {
      message = "TASKORA is temporarily unavailable. Please try again later.";
      buttons = [{ id: "open", label: "🚀 OPEN TASKORA", type: "web_app", path: "/" }];
    }
  }

  const text = personalize(message, opts.username, opts.firstName);
  const reply_markup = buildInlineKeyboard(buttons, mini, community);

  if (photoFileId || photoUrl) {
    await tg("sendPhoto", {
      chat_id: opts.chatId,
      photo: photoFileId || photoUrl,
      caption: text.slice(0, 1024),
      reply_markup,
    });
  } else {
    await tg("sendMessage", {
      chat_id: opts.chatId,
      text: text.slice(0, 4096),
      reply_markup,
      disable_web_page_preview: true,
    });
  }
}

export const ownerGetBotWelcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(async ({ context }) => {
    const db = await guard(context.userId);
    const { data, error } = await db.from("bot_welcome_settings").select("*").eq("id", true).maybeSingle();
    if (error) throw new Error(error.message);
    const row = data ?? {};
    return {
      enabled: row.enabled !== false,
      photo_url: (row.photo_url as string | null) ?? null,
      message_text: (row.message_text as string) || DEFAULT_MESSAGE,
      buttons: normalizeButtons(row.buttons),
      community_url: (row.community_url as string) || "https://t.me/Taskoraplus",
      mini_app_url:
        (row.mini_app_url as string | null) ||
        process.env["MINI_APP_URL"] ||
        process.env["VITE_MINI_APP_URL"] ||
        null,
      draft_photo_url: (row.draft_photo_url as string | null) ?? (row.photo_url as string | null) ?? null,
      draft_message_text:
        (row.draft_message_text as string) || (row.message_text as string) || DEFAULT_MESSAGE,
      draft_buttons: normalizeButtons(row.draft_buttons ?? row.buttons),
      draft_community_url:
        (row.draft_community_url as string) || (row.community_url as string) || "https://t.me/Taskoraplus",
      draft_mini_app_url:
        (row.draft_mini_app_url as string | null) ||
        (row.mini_app_url as string | null) ||
        process.env["MINI_APP_URL"] ||
        null,
      previous_message_text: (row.previous_message_text as string | null) ?? null,
      published_at: (row.published_at as string | null) ?? null,
      updated_at: (row.updated_at as string) || new Date().toISOString(),
      defaults: { message: DEFAULT_MESSAGE, buttons: DEFAULT_BUTTONS },
    };
  });

export const ownerUploadBotWelcomePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d as { data_url: string })
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    const photo = validateBotWelcomePhoto(data.data_url);
    const bytes = Uint8Array.from(atob(photo.base64), (char) => char.charCodeAt(0));
    const path = `welcome/${Date.now()}-${crypto.randomUUID()}.${photo.contentType === "image/png" ? "png" : "jpg"}`;
    const { data: bucket } = await db.storage.getBucket("bot-welcome");
    if (!bucket) {
      const { error: createError } = await db.storage.createBucket("bot-welcome", {
        public: true,
        allowedMimeTypes: ["image/jpeg", "image/png"],
        fileSizeLimit: "5MB",
      });
      if (createError && !createError.message.toLowerCase().includes("already exists")) {
        throw new Error(`Could not create welcome photo storage: ${createError.message}`);
      }
    }
    const { error: uploadError } = await db.storage.from("bot-welcome").upload(path, bytes, {
      contentType: photo.contentType,
      cacheControl: "31536000",
      upsert: false,
    });
    if (uploadError) throw new Error(`Welcome photo upload failed: ${uploadError.message}`);
    const { data: publicUrl } = db.storage.from("bot-welcome").getPublicUrl(path);
    const { error: saveError } = await db.from("bot_welcome_settings").upsert({
      id: true,
      draft_photo_url: publicUrl.publicUrl,
      draft_photo_file_id: null,
      updated_at: new Date().toISOString(),
    });
    if (saveError) throw new Error(saveError.message);
    await audit({
      adminId: context.userId,
      action: "bot_welcome.photo_uploaded",
      targetType: "bot_welcome",
      targetId: "true",
      metadata: { path, bytes: photo.bytes, content_type: photo.contentType },
    });
    return { ok: true, photo_url: publicUrl.publicUrl };
  });

export const ownerSaveBotWelcomeDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: unknown) =>
      d as {
        message_text?: string;
        buttons?: WelcomeButton[];
        photo_url?: string | null;
        community_url?: string;
        mini_app_url?: string | null;
        enabled?: boolean;
      },
  )
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.message_text != null) payload.draft_message_text = String(data.message_text).slice(0, 4000);
    if (data.buttons != null) payload.draft_buttons = normalizeButtons(data.buttons);
    if (data.photo_url !== undefined) payload.draft_photo_url = data.photo_url;
    if (data.community_url != null) payload.draft_community_url = String(data.community_url).slice(0, 512);
    if (data.mini_app_url !== undefined) payload.draft_mini_app_url = data.mini_app_url;
    if (data.enabled != null) payload.enabled = Boolean(data.enabled);
    const { error } = await db.from("bot_welcome_settings").upsert({ id: true, ...payload });
    if (error) throw new Error(error.message);
    await audit({ adminId: context.userId, action: "bot_welcome.draft_saved", targetType: "bot_welcome", targetId: "true" });
    return { ok: true };
  });

export const ownerPublishBotWelcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(async ({ context }) => {
    const db = await guard(context.userId);
    const { data: cur, error: readErr } = await db.from("bot_welcome_settings").select("*").eq("id", true).maybeSingle();
    if (readErr) throw new Error(readErr.message);
    const draftMsg = (cur?.draft_message_text as string) || (cur?.message_text as string) || DEFAULT_MESSAGE;
    const draftBtns = normalizeButtons(cur?.draft_buttons ?? cur?.buttons ?? DEFAULT_BUTTONS);
    const draftPhoto = (cur?.draft_photo_url as string | null) ?? null;
    const draftCommunity = (cur?.draft_community_url as string) || (cur?.community_url as string) || "https://t.me/Taskoraplus";
    const draftMini = (cur?.draft_mini_app_url as string | null) ?? (cur?.mini_app_url as string | null) ?? null;
    const { error } = await db.from("bot_welcome_settings").upsert({
      id: true,
      previous_photo_url: cur?.photo_url ?? null,
      previous_message_text: cur?.message_text ?? null,
      previous_buttons: cur?.buttons ?? null,
      previous_community_url: cur?.community_url ?? null,
      previous_mini_app_url: cur?.mini_app_url ?? null,
      message_text: draftMsg,
      buttons: draftBtns,
      photo_url: draftPhoto,
      community_url: draftCommunity,
      mini_app_url: draftMini,
      published_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    await audit({ adminId: context.userId, action: "bot_welcome.published", targetType: "bot_welcome", targetId: "true" });
    return { ok: true, published_at: new Date().toISOString() };
  });

export const ownerRestoreBotWelcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(async ({ context }) => {
    const db = await guard(context.userId);
    const { data: cur, error: readErr } = await db.from("bot_welcome_settings").select("*").eq("id", true).maybeSingle();
    if (readErr) throw new Error(readErr.message);
    if (!cur?.previous_message_text) throw new Error("No previous version to restore.");
    const { error } = await db.from("bot_welcome_settings").upsert({
      id: true,
      draft_message_text: cur.previous_message_text,
      draft_buttons: cur.previous_buttons,
      draft_photo_url: cur.previous_photo_url,
      draft_community_url: cur.previous_community_url,
      draft_mini_app_url: cur.previous_mini_app_url,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    await audit({ adminId: context.userId, action: "bot_welcome.restored_to_draft", targetType: "bot_welcome", targetId: "true" });
    return { ok: true };
  });

export const ownerPreviewBotWelcome = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => d)
  .handler(async ({ context }) => {
    const db = await guard(context.userId);
    const { data: profile } = await db.from("profiles").select("telegram_id, username, display_name").eq("id", context.userId).maybeSingle();
    if (!profile?.telegram_id) throw new Error("Your profile has no telegram_id — open the Mini App once first.");
    await sendWelcomeToChat({ chatId: profile.telegram_id, username: profile.username, firstName: profile.display_name, useDraft: true });
    return { ok: true };
  });

export type TelegramUpdate = {
  update_id?: number;
  message?: { text?: string; chat?: { id: number }; from?: { id: number; username?: string; first_name?: string } };
  callback_query?: unknown;
  chat_member?: unknown;
  my_chat_member?: unknown;
};

export async function handleTelegramUpdate(update: TelegramUpdate) {
  const msg = update.message;
  if (!msg?.chat?.id) return { handled: false, reason: "no_chat" };
  const text = (msg.text ?? "").trim();
  const isStart = /^\/start(?:@\w+)?(?:\s|$)/i.test(text);
  if (!isStart) return { handled: false, reason: "not_start" };
  if (!process.env["TELEGRAM_BOT_TOKEN"]) {
    console.error("[handleTelegramUpdate] TELEGRAM_BOT_TOKEN missing");
    return { handled: false, reason: "no_token" };
  }
  try {
    await sendWelcomeToChat({
      chatId: msg.chat.id,
      username: msg.from?.username,
      firstName: msg.from?.first_name,
      useDraft: false,
    });
    return { handled: true, reason: "welcome_sent" };
  } catch (e) {
    console.error("[handleTelegramUpdate] sendWelcome failed", e);
    try {
      const token = process.env["TELEGRAM_BOT_TOKEN"]!;
      const mini =
        process.env["MINI_APP_URL"] ||
        process.env["VITE_MINI_APP_URL"] ||
        process.env["PUBLIC_APP_URL"] ||
        "";
      await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: msg.chat.id,
          text: "Welcome to TASKORA. Open the Mini App to earn.",
          reply_markup: mini
            ? { inline_keyboard: [[{ text: "🚀 OPEN TASKORA", web_app: { url: mini } }]] }
            : undefined,
        }),
      });
      return { handled: true, reason: "fallback_sent" };
    } catch (e2) {
      console.error("[handleTelegramUpdate] fallback failed", e2);
      return { handled: false, reason: e instanceof Error ? e.message : "send_failed" };
    }
  }
}
