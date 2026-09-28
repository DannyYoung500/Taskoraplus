import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Audience = "all_active" | "all_telegram";

async function ownerContext(userId: string) {
  const { assertOwner, admin, audit } = await import("@/lib/owner-guard.server");
  await assertOwner(userId);
  return { db: await admin(), audit };
}

export const listTelegramBroadcasts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await ownerContext(context.userId);
    const { data, error } = await db
      .from("telegram_broadcasts")
      .select("id,title,body,media_url,button_text,button_url,audience,status,total_recipients,sent_count,failed_count,blocked_count,created_at,started_at,completed_at")
      .order("created_at", { ascending: false }).limit(25);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createTelegramBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { title: string; body: string; mediaUrl?: string; buttonText?: string; buttonUrl?: string; audience?: Audience }) => d)
  .handler(async ({ data, context }) => {
    const { db, audit } = await ownerContext(context.userId);
    const title = data.title.trim();
    const body = data.body.trim();
    if (!title || !body) throw new Error("Title and message are required.");
    if (body.length > 4096) throw new Error("Telegram message text must be 4096 characters or fewer.");
    if (data.buttonUrl && !/^https?:\\/\\//i.test(data.buttonUrl.trim())) throw new Error("Button URL must start with http:// or https://.");
    const audience = data.audience ?? "all_active";
    const { data: recipients, error: recipientError } = await db
      .from("profiles").select("telegram_id,account_status,status")
      .not("telegram_id", "is", null);
    if (recipientError) throw new Error(recipientError.message);
    const ids = (recipients ?? []).filter((p: any) => audience === "all_telegram" || (p.account_status !== "blocked" && p.status !== "blocked")).map((p: any) => Number(p.telegram_id)).filter(Number.isFinite);
    if (!ids.length) throw new Error("No eligible Telegram users are available for this audience.");
    const { data: broadcast, error } = await db.from("telegram_broadcasts").insert({
      title, body, media_url: data.mediaUrl?.trim() || null, button_text: data.buttonText?.trim() || null,
      button_url: data.buttonUrl?.trim() || null, audience, total_recipients: ids.length, created_by: context.userId
    }).select("id").single();
    if (error) throw new Error(error.message);
    const rows = ids.map((telegram_id) => ({ broadcast_id: broadcast.id, telegram_id }));
    const { error: insertError } = await db.from("telegram_broadcast_recipients").insert(rows);
    if (insertError) {
      await db.from("telegram_broadcasts").delete().eq("id", broadcast.id);
      throw new Error(insertError.message);
    }
    await audit({ adminId: context.userId, action: "telegram_broadcast.create", targetType: "telegram_broadcast", targetId: broadcast.id, next: { title, audience, recipients: ids.length } });
    return broadcast;
  });

export const processTelegramBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { broadcastId: string }) => d)
  .handler(async ({ data, context }) => {
    const { db, audit } = await ownerContext(context.userId);
    const token = (process.env.TELEGRAM_BOT_TOKEN || "").trim();
    if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not configured.");
    const { data: broadcast, error: bError } = await db.from("telegram_broadcasts").select("*").eq("id", data.broadcastId).single();
    if (bError || !broadcast) throw new Error("Broadcast not found.");
    if (broadcast.status === "completed") return broadcast;
    await db.from("telegram_broadcasts").update({ status: "sending", started_at: broadcast.started_at ?? new Date().toISOString() }).eq("id", broadcast.id);

    const { data: recipients, error: rError } = await db.from("telegram_broadcast_recipients")
      .select("id,telegram_id,attempts").eq("broadcast_id", broadcast.id).eq("status","pending")
      .or("next_attempt_at.is.null,next_attempt_at.lte." + new Date().toISOString()).order("id").limit(20);
    if (rError) throw new Error(rError.message);

    const reply_markup = broadcast.button_text && broadcast.button_url ? { inline_keyboard: [[{ text: broadcast.button_text, url: broadcast.button_url }]] } : undefined;
    for (const recipient of recipients ?? []) {
      const endpoint = broadcast.media_url ? "sendPhoto" : "sendMessage";
      const payload = broadcast.media_url
        ? { chat_id: recipient.telegram_id, photo: broadcast.media_url, caption: broadcast.body, parse_mode: "HTML", reply_markup }
        : { chat_id: recipient.telegram_id, text: broadcast.body, parse_mode: "HTML", reply_markup };
      try {
        const response = await fetch(`https://api.telegram.org/bot${token}/${endpoint}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
        const result = await response.json() as any;
        if (response.status === 429) {
          const retry = Math.max(1, Number(result?.parameters?.retry_after ?? 5));
          await db.from("telegram_broadcast_recipients").update({ attempts: (recipient.attempts ?? 0) + 1, next_attempt_at: new Date(Date.now() + retry * 1000).toISOString(), error_message: "Telegram rate limit" }).eq("id", recipient.id);
          break;
        }
        if (!response.ok || !result?.ok) {
          const description = String(result?.description ?? "Telegram rejected the message");
          const blocked = /blocked|chat not found|user is deactivated|bot was blocked/i.test(description);
          await db.from("telegram_broadcast_recipients").update({ status: blocked ? "blocked" : "failed", attempts: (recipient.attempts ?? 0) + 1, error_message: description }).eq("id", recipient.id);
          continue;
        }
        await db.from("telegram_broadcast_recipients").update({ status: "sent", attempts: (recipient.attempts ?? 0) + 1, sent_at: new Date().toISOString(), error_message: null }).eq("id", recipient.id);
      } catch (error) {
        await db.from("telegram_broadcast_recipients").update({ status: "failed", attempts: (recipient.attempts ?? 0) + 1, error_message: error instanceof Error ? error.message : "Network error" }).eq("id", recipient.id);
      }
    }

    const { count: pending } = await db.from("telegram_broadcast_recipients").select("id", { count: "exact", head: true }).eq("broadcast_id", broadcast.id).eq("status","pending");
    const { count: sent } = await db.from("telegram_broadcast_recipients").select("id", { count: "exact", head: true }).eq("broadcast_id", broadcast.id).eq("status","sent");
    const { count: failed } = await db.from("telegram_broadcast_recipients").select("id", { count: "exact", head: true }).eq("broadcast_id", broadcast.id).eq("status","failed");
    const { count: blocked } = await db.from("telegram_broadcast_recipients").select("id", { count: "exact", head: true }).eq("broadcast_id", broadcast.id).eq("status","blocked");
    const done = (pending ?? 0) === 0;
    const { data: updated, error: updateError } = await db.from("telegram_broadcasts").update({
      status: done ? "completed" : "sending", sent_count: sent ?? 0, failed_count: failed ?? 0, blocked_count: blocked ?? 0,
      completed_at: done ? new Date().toISOString() : null
    }).eq("id", broadcast.id).select("*").single();
    if (updateError) throw new Error(updateError.message);
    if (done) await audit({ adminId: context.userId, action: "telegram_broadcast.completed", targetType: "telegram_broadcast", targetId: broadcast.id, next: { sent: sent ?? 0, failed: failed ?? 0, blocked: blocked ?? 0 } });
    return updated;
  });
