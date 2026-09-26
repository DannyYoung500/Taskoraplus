const TASK_CHANNEL = "@TaskoraPlusNoti";
const COMMUNITY = "@TaskoraCommunity";
const APP_URL = "https://taskoraplus.app";

function esc(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function telegram(method: string, body: Record<string, unknown>) {
  const token = process.env["TELEGRAM_BOT_TOKEN"] ?? "";
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as { ok?: boolean; description?: string; result?: any };
  if (!json.ok) throw new Error(json.description ?? `Telegram ${method} failed`);
  return json.result;
}

async function userChatId(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("telegram_id")
    .eq("id", userId)
    .maybeSingle();
  return data?.telegram_id ? String(data.telegram_id) : null;
}

export async function sendUserHtml(input: {
  userId: string;
  text: string;
  buttons?: { text: string; url: string }[];
  photoUrl?: string | null;
}) {
  const chatId = await userChatId(input.userId);
  if (!chatId) return { ok: false, skipped: true };

  const replyMarkup = input.buttons?.length
    ? { inline_keyboard: input.buttons.map((button) => [{ text: button.text, url: button.url }]) }
    : undefined;

  if (input.photoUrl) {
    const safeCaption = input.text.replace(/https?:\/\/\S+/gi, "").trim();
    await telegram("sendPhoto", {
      chat_id: chatId,
      photo: input.photoUrl,
      caption: safeCaption.slice(0, 1024),
      parse_mode: "HTML",
      reply_markup: replyMarkup,
    });
  } else {
    await telegram("sendMessage", {
      chat_id: chatId,
      text: input.text.slice(0, 4096),
      parse_mode: "HTML",
      disable_web_page_preview: true,
      reply_markup: replyMarkup,
    });
  }

  return { ok: true };
}

export async function publishNewTaskNotification(task: any) {
  const id = String(task.id);
  const text =
    `🆕 <b>New Task Available!</b>\n\n` +
    `📋 Task: ${esc(task.title || "Task")} #${id.slice(0, 8)}\n` +
    `🏷️ Type: ${esc(task.task_type || task.platform || "Task")}\n` +
    `👥 Slots: ${Number(task.slots_left ?? task.slots_total ?? 0)}\n` +
    `💰 Reward: +${Number(task.reward ?? 0).toFixed(2)} USDT\n\n` +
    `🎯 Complete the task to earn rewards!\n\n━━━━━━━━━━━━━━━\n` +
    `🔔 @TaskoraPlusNoti | 📢 @TaskoraPlus\n👥 @TaskoraCommunity`;

  await telegram("sendMessage", {
    chat_id: TASK_CHANNEL,
    text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    reply_markup: {
      inline_keyboard: [
        [{ text: "🎯 Join Now", url: `${APP_URL}/tasks/${id}` }],
        [{ text: "🔔 Get Tasks First", url: "https://t.me/TaskoraPlusNoti" }],
      ],
    },
  });
  return { ok: true };
}

export const notifyTaskSubmitted = (userId: string, task: any) =>
  sendUserHtml({
    userId,
    text:
      `📤 <b>Task Submitted!</b>\n\n📋 Task: ${esc(task?.title)}\n` +
      `💰 Potential Reward: +${Number(task?.reward ?? 0).toFixed(2)} USDT\n` +
      `🔎 Status: <b>Pending Review</b>\n\n⏳ Your submission is being reviewed.`,
  });

export const notifyTaskCompleted = (userId: string, task: any, points = 0) =>
  sendUserHtml({
    userId,
    text:
      `✅ <b>Task Completed!</b>\n\n📋 Task: ${esc(task?.title)}\n` +
      `💰 Reward: +${Number(task?.reward ?? 0).toFixed(2)} USDT` +
      (points > 0 ? `\n🎯 Task Points: +${points} TP` : "") +
      `\n\n🎉 Great job! Keep earning more.`,
  });

export const notifyTaskRejected = (userId: string, task: any, reason: string) =>
  sendUserHtml({
    userId,
    text:
      `❌ <b>Task Rejected</b>\n\n📋 Task: ${esc(task?.title)}\n` +
      `📝 Reason: ${esc(reason || "Requirements were not met.")}\n\n` +
      `🔄 Please correct the issue and resubmit.`,
    buttons: [
      { text: "🔄 Resubmit", url: `https://t.me/TaskoraPlusBot?start=task_${task?.id ?? ""}` },
      { text: "💬 Community Help", url: `https://t.me/${COMMUNITY.slice(1)}` },
    ],
  });

export const notifyWithdrawalRequested = (userId: string, row: any) =>
  sendUserHtml({
    userId,
    text:
      `📤 <b>Withdrawal Requested</b>\n\n💰 Amount: ${Number(row.amount ?? 0).toFixed(2)} USDT\n` +
      `📍 Network: ${esc(row.method)}\n💳 Wallet: <code>${esc(row.address)}</code>\n` +
      `🧾 Ref: <code>${esc(row.reference || row.id)}</code>\n\n⏳ Status: <b>Processing</b>`,
  });

export const notifyWithdrawalReview = (userId: string, row: any) =>
  sendUserHtml({
    userId,
    text:
      `🔎 <b>Withdrawal Under Review</b>\n\n💰 Amount: ${Number(row.amount ?? 0).toFixed(2)} USDT\n` +
      `📍 Network: ${esc(row.method)}\n🧾 Ref: <code>${esc(row.reference || row.id)}</code>\n\n` +
      `⏳ Your withdrawal is currently being reviewed.`,
  });

export const notifyWithdrawalRejected = (userId: string, row: any, reason: string) =>
  sendUserHtml({
    userId,
    text:
      `❌ <b>Withdrawal Failed</b>\n\n💰 Amount: ${Number(row.amount ?? 0).toFixed(2)} USDT\n` +
      `📍 Network: ${esc(row.method)}\n🧾 Ref: <code>${esc(row.reference || row.id)}</code>\n` +
      `📝 Reason: ${esc(reason || "Payment could not be completed.")}`,
    buttons: [{ text: "💬 Contact Support", url: `https://t.me/${COMMUNITY.slice(1)}` }],
  });

export async function notifyWithdrawalPaid(userId: string, row: any) {
  let photoUrl: string | null = null;
  let template =
    "✅ <b>Payout Successful!</b>\n\n💰 Amount: #amount USDT\n📍 Network: #method\n🧾 Ref: #reference\n\n🎉 Payment completed successfully.\n🕐 Time: #time";

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await (supabaseAdmin as any)
      .from("taskora_notification_settings")
      .select("payout_image_url,payout_message_template")
      .eq("id", true)
      .maybeSingle();
    photoUrl = data?.payout_image_url ?? null;
    template = String(data?.payout_message_template || template);
  } catch {
    // Defaults are used when optional notification settings are unavailable.
  }

  const tx = String(row.tx_hash ?? "");
  const text = template
    .replaceAll("#amount", Number(row.amount ?? 0).toFixed(2))
    .replaceAll("#method", esc(row.method || "USDT"))
    .replaceAll("#reference", esc(String(row.reference || row.id).slice(0, 32)))
    .replaceAll("#tx_hash", esc(tx || "Not supplied"))
    .replaceAll("#time", esc(new Date().toLocaleString()))
    .replace(/\\n/g, "\n");

  return sendUserHtml({
    userId,
    text,
    photoUrl,
    buttons: tx
      ? [{ text: "🔗 View Transaction", url: tx.startsWith("http") ? tx : `https://tronscan.org/#/transaction/${encodeURIComponent(tx)}` }]
      : [],
  });
}

export const notifyCheckinSuccess = (userId: string, streak: number, points: number, bonus = 0) =>
  sendUserHtml({
    userId,
    text:
      `🎉 <b>Check-in Successful!</b>\n\n🔥 Streak: ${streak} days\n🎯 Task Points: +${points} TP` +
      (bonus > 0 ? `\n🎁 Streak Bonus: +${bonus} TP` : "") +
      "\n\n🚀 Check in tomorrow for more points!",
  });
