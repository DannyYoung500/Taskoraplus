import { createServerFn } from "@tanstack/react-start";

const TASK_CHANNEL = "@TaskoraPlusNoti";
const COMMUNITY = "@TaskoraCommunity";
const APP_URL = "https://taskoraplus.app";

function esc(v: unknown) {
  return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function tg(method: string, body: Record<string, unknown>) {
  const token = process.env["TELEGRAM_BOT_TOKEN"] ?? "";
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const j = await r.json() as any;
  if (!j.ok) throw new Error(j.description || `Telegram ${method} failed`);
  return j.result;
}

async function claim(key: string, userId?: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await (supabaseAdmin as any).from("telegram_notification_log").insert({ event_key: key, user_id: userId || null, status: "sending" } as never).select("id").maybeSingle();
  if (error && /duplicate|unique/i.test(error.message)) return null;
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

async function finish(id: string | null, status: "sent" | "failed", messageId?: number | null, error?: string) {
  if (!id) return;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await (supabaseAdmin as any).from("telegram_notification_log").update({ status, telegram_message_id: messageId ?? null, error_message: error?.slice(0, 500) ?? null, sent_at: status === "sent" ? new Date().toISOString() : null } as never).eq("id", id);
}

async function userChatId(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin.from("profiles").select("telegram_id").eq("id", userId).maybeSingle();
  return data?.telegram_id ? String(data.telegram_id) : null;
}

export async function sendUserHtml(o: { userId: string; eventKey: string; text: string; buttons?: { text: string; url: string }[]; photoUrl?: string | null }) {
  try {
    const chatId = await userChatId(o.userId);
    if (!chatId) return { ok: false, skipped: true };
    const log = await claim(o.eventKey, o.userId);
    if (!log) return { ok: true, duplicate: true };
    try {
      const markup = o.buttons?.length ? { inline_keyboard: o.buttons.map(b => [{ text: b.text, url: b.url }]) } : undefined;
      const result = o.photoUrl
        ? await tg("sendPhoto", { chat_id: chatId, photo: o.photoUrl, caption: o.text.slice(0, 1024), parse_mode: "HTML", reply_markup: markup })
        : await tg("sendMessage", { chat_id: chatId, text: o.text.slice(0, 4096), parse_mode: "HTML", disable_web_page_preview: true, reply_markup: markup });
      await finish(log, "sent", Number(result?.message_id ?? 0));
      return { ok: true };
    } catch (e) {
      await finish(log, "failed", null, e instanceof Error ? e.message : "Telegram send failed");
      throw e;
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Notification failed" };
  }
}

export async function publishNewTaskNotification(task: any) {
  try {
    const id = String(task.id);
    const log = await claim(`task:new:${id}`);
    if (!log) return { ok: true, duplicate: true };
    const metadata = task.task_metadata && typeof task.task_metadata === "object" ? task.task_metadata : {};
    const tp = Number(metadata.task_points ?? task.task_points ?? 0);
    const tpLine = tp > 0 ? ` & 🎯 +${tp} TP` : "";
    const text = `🆕 <b>New Task Available!</b>\\n\\n📋 Task: ${esc(task.title || "Task")} #${id.slice(0, 8)}\\n🏷️ Type: ${esc(task.task_type || task.platform || "Task")}\\n👥 Slots: ${Number(task.slots_left ?? task.slots_total ?? 0)}\\n💰 Reward: +${Number(task.reward ?? 0).toFixed(2)} USDT${tpLine}\\n\\n🎯 Complete the task to earn rewards!\\n\\n━━━━━━━━━━━━━━━\\n🔔 @TaskoraPlusNoti | 📢 @TaskoraPlus\\n👥 @TaskoraCommunity`;
    try {
      const result = await tg("sendMessage", {
        chat_id: TASK_CHANNEL, text, parse_mode: "HTML", disable_web_page_preview: true,
        reply_markup: { inline_keyboard: [[{ text: "🎯 Join Now", url: `${APP_URL}/tasks/${id}` }], [{ text: "🔔 Get Tasks First", url: "https://t.me/TaskoraPlusNoti" }]] },
      });
      await finish(log, "sent", Number(result?.message_id ?? 0));
      return { ok: true };
    } catch (e) {
      await finish(log, "failed", null, e instanceof Error ? e.message : "Task post failed");
      throw e;
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Task notification failed" };
  }
}

export const publishNewTaskNotificationServer = createServerFn({ method: "POST" }).handler(async ({ data }: { data: { task: any } }) => publishNewTaskNotification(data.task));

export const notifyTaskSubmitted = async (userId: string, task: any, id: string) => sendUserHtml({ userId, eventKey: `submission:submitted:${id}`, text: `📤 <b>Task Submitted!</b>\\n\\n📋 Task: ${esc(task?.title)}\\n💰 Potential Reward: +${Number(task?.reward ?? 0).toFixed(2)} USDT\\n🔎 Status: <b>Pending Review</b>\\n\\n⏳ Your submission has been received and is being reviewed.` });

export const notifyTaskCompleted = async (userId: string, task: any, id: string, tp = 0) => sendUserHtml({ userId, eventKey: `submission:verified:${id}`, text: `✅ <b>Task Completed!</b>\\n\\n📋 Task: ${esc(task?.title)}\\n💰 Reward: +${Number(task?.reward ?? 0).toFixed(2)} USDT${tp > 0 ? `\\n🎯 Task Points: +${tp} TP` : ""}\\n\\n🎉 Great job! Keep earning more.` });

export const notifyTaskRejected = async (userId: string, task: any, id: string, reason: string) => sendUserHtml({ userId, eventKey: `submission:rejected:${id}`, text: `❌ <b>Task Rejected</b>\\n\\n📋 Task: ${esc(task?.title)}\\n📝 Reason: ${esc(reason || "Requirements were not met.")}\\n\\n🔄 Please correct the issue and resubmit.`, buttons: [{ text: "🔄 Resubmit", url: `https://t.me/TaskoraPlusBot?start=task_${task?.id ?? ""}` }, { text: "💬 Community Help", url: `https://t.me/${COMMUNITY.slice(1)}` }] });

export const notifyWithdrawalRequested = async (userId: string, row: any) => sendUserHtml({ userId, eventKey: `withdrawal:requested:${row.id}`, text: `📤 <b>Withdrawal Requested</b>\\n\\n💰 Amount: ${Number(row.amount ?? 0).toFixed(2)} USDT\\n📍 Network: ${esc(row.method)}\\n💳 Wallet: <code>${esc(row.address)}</code>\\n🧾 Ref: <code>${esc(row.reference || row.id)}</code>\\n\\n⏳ Status: <b>Processing</b>` });

export const notifyWithdrawalRejected = async (userId: string, row: any, reason: string) => sendUserHtml({ userId, eventKey: `withdrawal:rejected:${row.id}`, text: `❌ <b>Withdrawal Failed</b>\\n\\n💰 Amount: ${Number(row.amount ?? 0).toFixed(2)} USDT\\n📍 Network: ${esc(row.method)}\\n🧾 Ref: <code>${esc(row.reference || row.id)}</code>\\n📝 Reason: ${esc(reason || "Payment could not be completed.")}\\n\\n↩️ If applicable, the amount has been returned to your available balance.`, buttons: [{ text: "💬 Contact Support", url: `https://t.me/${COMMUNITY.slice(1)}` }] });

export async function notifyWithdrawalPaid(userId: string, row: any) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: settings } = await (supabaseAdmin as any).from("taskora_notification_settings").select("payout_image_url,payout_message_template").eq("id", true).maybeSingle();
  const tx = String(row.tx_hash ?? "");
  const text = String(settings?.payout_message_template || "✅ <b>Payout Successful!</b>\\n\\n💰 Amount: #amount USDT\\n📍 Network: #method\\n🧾 Ref: #reference\\n\\n🎉 Payment completed successfully.\\n🕐 Time: #time")
    .replaceAll("#amount", Number(row.amount ?? 0).toFixed(2)).replaceAll("#method", esc(row.method || "USDT"))
    .replaceAll("#reference", esc(String(row.reference || row.id).slice(0, 32))).replaceAll("#tx_hash", esc(tx || "Not supplied"))
    .replaceAll("#time", esc(new Date().toISOString())).replace(/\\n/g, "\n");
  return sendUserHtml({ userId, eventKey: `withdrawal:paid:${row.id}`, text, photoUrl: settings?.payout_image_url || null, buttons: tx ? [{ text: "🔗 View Transaction", url: tx.startsWith("http") ? tx : `https://tronscan.org/#/transaction/${encodeURIComponent(tx)}` }] : [] });
}

export const notifyCheckinSuccess = async (userId: string, streak: number, points: number, bonus = 0) => sendUserHtml({ userId, eventKey: `checkin:success:${new Date().toISOString().slice(0, 10)}:${userId}`, text: `🎉 <b>Check-in Successful!</b>\\n\\n🔥 Streak: ${streak} days\\n🎯 Task Points: +${points} TP${bonus > 0 ? `\\n🎁 Streak Bonus: +${bonus} TP` : ""}\\n\\n🚀 Check in tomorrow for more points!` });
