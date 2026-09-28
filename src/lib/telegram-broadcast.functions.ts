import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Audience = "all_active" | "all_telegram";

type BroadcastInput = {
  title: string;
  body: string;
  mediaUrl?: string;
  buttonText?: string;
  buttonUrl?: string;
  audience?: Audience;
  disableNotification?: boolean;
  protectContent?: boolean;
};

async function ownerContext(userId: string) {
  const { assertOwner, admin, audit } = await import("@/lib/owner-guard.server");
  await assertOwner(userId);
  return { db: await admin(), audit };
}

function validateUrl(value?: string) {
  return !value || /^https?:\/\//i.test(value.trim());
}

async function telegramSend(token: string, chatId: number, input: {
  body: string;
  mediaUrl?: string;
  buttonText?: string;
  buttonUrl?: string;
  disableNotification?: boolean;
  protectContent?: boolean;
}) {
  const reply_markup = input.buttonText && input.buttonUrl
    ? { inline_keyboard: [[{ text: input.buttonText, url: input.buttonUrl }]] }
    : undefined;
  const endpoint = input.mediaUrl ? "sendPhoto" : "sendMessage";
  const payload = input.mediaUrl
    ? {
        chat_id: chatId,
        photo: input.mediaUrl,
        caption: input.body,
        parse_mode: "HTML",
        reply_markup,
        disable_notification: Boolean(input.disableNotification),
        protect_content: Boolean(input.protectContent),
      }
    : {
        chat_id: chatId,
        text: input.body,
        parse_mode: "HTML",
        reply_markup,
        disable_notification: Boolean(input.disableNotification),
        protect_content: Boolean(input.protectContent),
      };

  const response = await fetch(`https://api.telegram.org/bot${token}/${endpoint}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await response.json() as {
    ok?: boolean;
    description?: string;
    parameters?: { retry_after?: number };
  };
  return { response, result };
}

export const listTelegramBroadcasts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await ownerContext(context.userId);
    const { data, error } = await db
      .from("telegram_broadcasts")
      .select("id,title,body,media_url,button_text,button_url,audience,status,total_recipients,sent_count,failed_count,blocked_count,disable_notification,protect_content,created_at,started_at,completed_at")
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createTelegramBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: BroadcastInput) => d)
  .handler(async ({ data, context }) => {
    const { db, audit } = await ownerContext(context.userId);
    const title = data.title.trim();
    const body = data.body.trim();
    const mediaUrl = data.mediaUrl?.trim() || "";
    const buttonText = data.buttonText?.trim() || "";
    const buttonUrl = data.buttonUrl?.trim() || "";

    if (!title || !body) throw new Error("Title and message are required.");
    if (body.length > 4096) throw new Error("Telegram message text must be 4096 characters or fewer.");
    if (!validateUrl(buttonUrl)) throw new Error("Button URL must start with http:// or https://.");
    if (mediaUrl && !validateUrl(mediaUrl)) throw new Error("Image URL must start with http:// or https://.");
    if ((buttonText && !buttonUrl) || (!buttonText && buttonUrl)) throw new Error("Button text and button URL must be provided together.");

    const audience = data.audience ?? "all_active";
    const { data: recipients, error: recipientError } = await db
      .from("profiles")
      .select("telegram_id,account_status,status")
      .not("telegram_id", "is", null);
    if (recipientError) throw new Error(recipientError.message);

    const ids = (recipients ?? [])
      .filter((p: { telegram_id: number | null; account_status?: string; status?: string }) =>
        audience === "all_telegram" || (p.account_status !== "blocked" && p.status !== "blocked"))
      .map((p) => Number(p.telegram_id))
      .filter(Number.isFinite);

    if (!ids.length) throw new Error("No eligible Telegram users are available for this audience.");

    const { data: broadcast, error } = await db
      .from("telegram_broadcasts")
      .insert({
        title,
        body,
        media_url: mediaUrl || null,
        button_text: buttonText || null,
        button_url: buttonUrl || null,
        audience,
        disable_notification: Boolean(data.disableNotification),
        protect_content: Boolean(data.protectContent),
        total_recipients: ids.length,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const rows = ids.map((telegram_id) => ({ broadcast_id: broadcast.id, telegram_id }));
    const { error: insertError } = await db.from("telegram_broadcast_recipients").insert(rows);
    if (insertError) {
      await db.from("telegram_broadcasts").delete().eq("id", broadcast.id);
      throw new Error(insertError.message);
    }

    await audit({
      adminId: context.userId,
      action: "telegram_broadcast.create",
      targetType: "telegram_broadcast",
      targetId: broadcast.id,
      next: { title, audience, recipients: ids.length },
    });
    return broadcast;
  });

export const sendTelegramBroadcastTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: BroadcastInput) => d)
  .handler(async ({ data, context }) => {
    const { db } = await ownerContext(context.userId);
    const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured.");

    const { data: profile, error } = await db
      .from("profiles")
      .select("telegram_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const chatId = Number(profile?.telegram_id);
    if (!Number.isFinite(chatId)) throw new Error("Your owner account is not linked to a Telegram chat.");

    const body = data.body.trim();
    const mediaUrl = data.mediaUrl?.trim() || "";
    const buttonText = data.buttonText?.trim() || "";
    const buttonUrl = data.buttonUrl?.trim() || "";
    if (!body) throw new Error("Message is required.");
    if (body.length > 4096) throw new Error("Telegram message text must be 4096 characters or fewer.");
    if (!validateUrl(buttonUrl) || !validateUrl(mediaUrl)) throw new Error("URLs must start with http:// or https://.");
    if ((buttonText && !buttonUrl) || (!buttonText && buttonUrl)) throw new Error("Button text and button URL must be provided together.");

    const { response, result } = await telegramSend(token, chatId, {
      body,
      mediaUrl: mediaUrl || undefined,
      buttonText: buttonText || undefined,
      buttonUrl: buttonUrl || undefined,
      disableNotification: data.disableNotification,
      protectContent: data.protectContent,
    });
    if (!response.ok || !result.ok) throw new Error(result.description || "Telegram rejected the test message.");
    return { ok: true };
  });

export const retryFailedTelegramBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { broadcastId: string }) => d)
  .handler(async ({ data, context }) => {
    const { db, audit } = await ownerContext(context.userId);
    const { data: broadcast, error } = await db
      .from("telegram_broadcasts")
      .select("id,status")
      .eq("id", data.broadcastId)
      .single();
    if (error || !broadcast) throw new Error("Broadcast not found.");

    const { count, error: resetError } = await db
      .from("telegram_broadcast_recipients")
      .update({ status: "pending", attempts: 0, error_message: null, next_attempt_at: null })
      .eq("broadcast_id", broadcast.id)
      .eq("status", "failed")
      .select("id", { count: "exact", head: true });
    if (resetError) throw new Error(resetError.message);

    await db.from("telegram_broadcasts").update({
      status: count ? "sending" : broadcast.status,
      completed_at: null,
    }).eq("id", broadcast.id);

    await audit({
      adminId: context.userId,
      action: "telegram_broadcast.retry_failed",
      targetType: "telegram_broadcast",
      targetId: broadcast.id,
      next: { retried: count ?? 0 },
    });
    return { retried: count ?? 0 };
  });

export const processTelegramBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { broadcastId: string }) => d)
  .handler(async ({ data, context }) => {
    const { db, audit } = await ownerContext(context.userId);
    const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured.");

    const { data: broadcast, error: bError } = await db
      .from("telegram_broadcasts")
      .select("*")
      .eq("id", data.broadcastId)
      .single();
    if (bError || !broadcast) throw new Error("Broadcast not found.");
    if (broadcast.status === "completed") return broadcast;

    await db.from("telegram_broadcasts").update({
      status: "sending",
      started_at: broadcast.started_at ?? new Date().toISOString(),
    }).eq("id", broadcast.id);

    const { data: recipients, error: rError } = await db
      .from("telegram_broadcast_recipients")
      .select("id,telegram_id,attempts")
      .eq("broadcast_id", broadcast.id)
      .eq("status", "pending")
      .or("next_attempt_at.is.null,next_attempt_at.lte." + new Date().toISOString())
      .order("id")
      .limit(20);
    if (rError) throw new Error(rError.message);

    for (const recipient of recipients ?? []) {
      try {
        const { response, result } = await telegramSend(token, Number(recipient.telegram_id), {
          body: broadcast.body,
          mediaUrl: broadcast.media_url ?? undefined,
          buttonText: broadcast.button_text ?? undefined,
          buttonUrl: broadcast.button_url ?? undefined,
          disableNotification: Boolean(broadcast.disable_notification),
          protectContent: Boolean(broadcast.protect_content),
        });

        if (response.status === 429) {
          const retry = Math.max(1, Number(result?.parameters?.retry_after ?? 5));
          await db.from("telegram_broadcast_recipients").update({
            attempts: (recipient.attempts ?? 0) + 1,
            next_attempt_at: new Date(Date.now() + retry * 1000).toISOString(),
            error_message: "Telegram rate limit",
          }).eq("id", recipient.id);
          break;
        }

        if (!response.ok || !result?.ok) {
          const description = String(result?.description ?? "Telegram rejected the message");
          const blocked = /blocked|chat not found|user is deactivated|bot was blocked/i.test(description);
          await db.from("telegram_broadcast_recipients").update({
            status: blocked ? "blocked" : "failed",
            attempts: (recipient.attempts ?? 0) + 1,
            error_message: description,
          }).eq("id", recipient.id);
          continue;
        }

        await db.from("telegram_broadcast_recipients").update({
          status: "sent",
          attempts: (recipient.attempts ?? 0) + 1,
          sent_at: new Date().toISOString(),
          error_message: null,
        }).eq("id", recipient.id);
      } catch (error) {
        await db.from("telegram_broadcast_recipients").update({
          status: "failed",
          attempts: (recipient.attempts ?? 0) + 1,
          error_message: error instanceof Error ? error.message : "Network error",
        }).eq("id", recipient.id);
      }
    }

    const { count: pending } = await db.from("telegram_broadcast_recipients")
      .select("id", { count: "exact", head: true }).eq("broadcast_id", broadcast.id).eq("status", "pending");
    const { count: sent } = await db.from("telegram_broadcast_recipients")
      .select("id", { count: "exact", head: true }).eq("broadcast_id", broadcast.id).eq("status", "sent");
    const { count: failed } = await db.from("telegram_broadcast_recipients")
      .select("id", { count: "exact", head: true }).eq("broadcast_id", broadcast.id).eq("status", "failed");
    const { count: blocked } = await db.from("telegram_broadcast_recipients")
      .select("id", { count: "exact", head: true }).eq("broadcast_id", broadcast.id).eq("status", "blocked");

    const done = (pending ?? 0) === 0;
    const { data: updated, error: updateError } = await db.from("telegram_broadcasts").update({
      status: done ? "completed" : "sending",
      sent_count: sent ?? 0,
      failed_count: failed ?? 0,
      blocked_count: blocked ?? 0,
      completed_at: done ? new Date().toISOString() : null,
    }).eq("id", broadcast.id).select("*").single();
    if (updateError) throw new Error(updateError.message);

    if (done) {
      await audit({
        adminId: context.userId,
        action: "telegram_broadcast.completed",
        targetType: "telegram_broadcast",
        targetId: broadcast.id,
        next: { sent: sent ?? 0, failed: failed ?? 0, blocked: blocked ?? 0 },
      });
    }
    return updated;
  });
