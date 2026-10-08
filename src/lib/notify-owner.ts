import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ownerChatIds(): Promise<{ botToken: string; ownerIds: string[] }> {
  const botToken = process.env["TELEGRAM_BOT_TOKEN"] ?? "";
  const ownerIds = String(
    process.env["TASKORA_OWNER_TELEGRAM_IDS"] ?? process.env["OWNER_TELEGRAM_IDS"] ?? "",
  )
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { botToken, ownerIds };
}

function esc(v: unknown) {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function resolveOpsId(): Promise<string> {
  let opsId =
    process.env["TASKORA_OPS_CHANNEL_ID"] ??
    process.env["OPS_CHANNEL_ID"] ??
    process.env["TASKORA_OWNER_CHANNEL_ID"] ??
    "";
  if (!opsId) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "owner_ops_channel")
        .maybeSingle();
      const v = (data?.value ?? {}) as { channel_id?: string; chat_id?: string };
      opsId = String(v.channel_id ?? v.chat_id ?? "").trim();
    } catch {}
  }
  return opsId;
}

/** Send to owner DMs + private ops channel. Never throws. */
export async function sendOwnerHtml(msg: string) {
  try {
    const { botToken, ownerIds } = await ownerChatIds();
    if (botToken && ownerIds.length) {
      await Promise.all(
        ownerIds.map((chatId) =>
          fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: msg,
              parse_mode: "HTML",
              disable_web_page_preview: true,
            }),
          }).catch(() => undefined),
        ),
      );
    }
    const opsId = await resolveOpsId();
    if (botToken && opsId) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          chat_id: opsId,
          text: msg,
          parse_mode: "HTML",
          disable_web_page_preview: true,
        }),
      }).catch(() => undefined);
    }
  } catch {}
}

export async function notifyOwnersNewUser(opts: {
  displayName: string;
  username?: string | null;
  telegramId: number;
}) {
  try {
    const uname = opts.username ? `@${opts.username}` : "no username";
    await sendOwnerHtml(
      `🆕 <b>New TASKORA user</b>\nName: ${esc(opts.displayName)}\nTelegram: ${esc(uname)}\nID: <code>${opts.telegramId}</code>\nTime: ${new Date().toISOString()}`,
    );
  } catch {}
}

export async function notifyOwnersLargeWithdrawal(opts: {
  userId: string;
  amount: number;
  method: string;
  address: string;
  requiresDual: boolean;
  displayName?: string | null;
}) {
  try {
    const dual = opts.requiresDual ? " · <b>DUAL APPROVAL</b>" : "";
    await sendOwnerHtml(
      `💸 <b>Withdrawal request</b>${dual}\nUser: ${esc(opts.displayName ?? opts.userId.slice(0, 8))}\nAmount: <b>$${Number(opts.amount).toFixed(2)}</b>\nMethod: ${esc(opts.method)}\nAddress: <code>${esc(opts.address.slice(0, 36))}${opts.address.length > 36 ? "…" : ""}</code>\nTime: ${new Date().toISOString()}`,
    );
  } catch {}
}

export async function notifyOwnersVelocityAlert(opts: {
  userId: string;
  kind: "submissions" | "withdrawals";
  count: number;
  limit: number;
  displayName?: string | null;
}) {
  try {
    const label = opts.kind === "submissions" ? "submissions / hour" : "WD requests / 24h";
    await sendOwnerHtml(
      `⚡ <b>Velocity alert</b>\nUser: ${esc(opts.displayName ?? opts.userId.slice(0, 8))}\nHit <b>${opts.count}/${opts.limit}</b> ${label}\nID: <code>${opts.userId.slice(0, 12)}</code>\nTime: ${new Date().toISOString()}`,
    );
  } catch {}
}

export async function notifyOwnersWithdrawalRequested(opts: {
  userId: string;
  amount: number;
  method: string;
  address: string;
  displayName?: string | null;
  reference?: string | null;
}) {
  await sendOwnerHtml(
    `🔔 <b>New Withdrawal</b>\n\n👤 User: ${esc(opts.displayName || opts.userId)}\n💰 Amount: ${opts.amount.toFixed(2)} USDT\n📍 Network: ${esc(opts.method)}\n💳 Wallet: <code>${esc(opts.address)}</code>\n🧾 Ref: <code>${esc(opts.reference || "")}</code>\n\n⏳ Status: Processing`,
  );
}

export async function notifyOwnersWithdrawalPaid(opts: {
  userId: string;
  amount: number;
  method: string;
  txHash?: string | null;
  reference?: string | null;
  displayName?: string | null;
}) {
  await sendOwnerHtml(
    `✅ <b>Withdrawal Paid</b>\n\n👤 User: ${esc(opts.displayName || opts.userId)}\n💰 Amount: ${opts.amount.toFixed(2)} USDT\n📍 Network: ${esc(opts.method)}\n🔗 Transaction: <code>${esc(opts.txHash || "—")}</code>\n🧾 Ref: <code>${esc(opts.reference || "")}</code>`,
  );
}

export async function notifyOwnersWithdrawalFailed(opts: {
  userId: string;
  amount: number;
  method: string;
  reason: string;
  reference?: string | null;
  displayName?: string | null;
}) {
  await sendOwnerHtml(
    `❌ <b>Withdrawal Failed</b>\n\n👤 User: ${esc(opts.displayName || opts.userId)}\n💰 Amount: ${opts.amount.toFixed(2)} USDT\n📍 Network: ${esc(opts.method)}\n📝 Reason: ${esc(opts.reason)}\n🧾 Ref: <code>${esc(opts.reference || "")}</code>`,
  );
}

const DEFAULT_PAYOUT_TEMPLATE =
  "✅ <b>PAYOUT COMPLETE</b>\\n\\nAmount: <b>#amount</b> USDT\\nNetwork: #method\\nUser: #name\\nUsername: #username\\nTo: <code>#address</code>\\nTx: <code>#tx_hash</code>\\nRef: <code>#reference</code>\\nTime: #time";

async function getPayoutProofSettings() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("payout_proof_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? {
    channel_id: "",
    message_template: DEFAULT_PAYOUT_TEMPLATE,
    payout_image_url: null,
  }) as any;
}

function normalizeTelegramChatRef(raw: string): string {
  let s = String(raw ?? "").trim();
  if (!s) return "";
  try {
    const lower = s.toLowerCase();
    if (lower.includes("t.me/") || lower.includes("telegram.me/")) {
      const u = new URL(s.startsWith("http") ? s : `https://${s}`);
      const path = u.pathname.split("/").filter(Boolean)[0] ?? "";
      if (path && !path.startsWith("+") && !path.startsWith("joinchat")) s = path;
    }
  } catch {}
  while (s.startsWith("@")) s = s.slice(1);
  if (s && (s.startsWith("-") || /^[0-9]+$/.test(s))) return s;
  return s ? `@${s}` : "";
}

function renderPayoutTemplate(template: string, values: Record<string, string>) {
  let result = template || DEFAULT_PAYOUT_TEMPLATE;
  for (const [key, value] of Object.entries(values)) result = result.split(key).join(value);
  return result.replace(/\\n/g, "\n");
}

export async function postPayoutProofToChannel(opts: {
  amount: number;
  method: string;
  address: string;
  txHash?: string | null;
  displayName?: string | null;
  username?: string | null;
  withdrawalId: string;
}) {
  try {
    const botToken = process.env["TELEGRAM_BOT_TOKEN"] ?? "";
    const settings = await getPayoutProofSettings();
    const channelId = normalizeTelegramChatRef(
      settings.channel_id ||
        process.env["TASKORA_PAYOUT_CHANNEL_ID"] ||
        process.env["PAYOUT_CHANNEL_ID"] ||
        "",
    );
    if (!botToken || !channelId) return;
    const username = opts.username ? String(opts.username).replace(/^@/, "") : "";
    const tx = (opts.txHash ?? "").trim();
    const address = opts.address || "";
    const message = renderPayoutTemplate(settings.message_template || DEFAULT_PAYOUT_TEMPLATE, {
      "#amount": Number(opts.amount).toFixed(2),
      "#method": esc(opts.method || "USDT"),
      "#name": esc(opts.displayName || "Tasker"),
      "#username": username ? "@" + esc(username) : "No username",
      "#address": esc(address.length > 16 ? address.slice(0, 8) + "…" + address.slice(-6) : address),
      "#tx_hash": tx ? esc(tx.slice(0, 64)) : "Pending / not supplied",
      "#reference": esc(opts.withdrawalId.slice(0, 8)),
      "#time": esc(new Date().toISOString()),
    });
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: channelId,
        text: message.slice(0, 4096),
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
    }).catch(() => undefined);
  } catch {}
}

export async function getPayoutChannelConfig() {
  const s = await getPayoutProofSettings();
  return {
    channel_id: s.channel_id ?? "",
    message_template: s.message_template || DEFAULT_PAYOUT_TEMPLATE,
    payout_image_url: s.payout_image_url ?? null,
  };
}

export async function setPayoutChannelConfig(channelId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const normalized = normalizeTelegramChatRef(channelId);
  const { error } = await supabaseAdmin
    .from("payout_proof_settings")
    .upsert({ id: true, channel_id: normalized, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return getPayoutChannelConfig();
}

export async function sendPayoutProofTest() {
  return { ok: true, channel_id: "", message_id: null, used_image: false };
}

export async function refreshPayoutChannelPreview() {
  return getPayoutChannelConfig();
}

export async function setPayoutPresentation(opts: {
  messageTemplate: string;
  imageDataUrl?: string;
  imageFileName?: string;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin
    .from("payout_proof_settings")
    .upsert(
      {
        id: true,
        message_template: String(opts.messageTemplate || DEFAULT_PAYOUT_TEMPLATE).slice(0, 3800),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  if (error) throw new Error(error.message);
  return getPayoutChannelConfig();
}

async function resolveTaskNotifyChannelId(): Promise<{ botToken: string; channelId: string }> {
  const botToken = process.env["TELEGRAM_BOT_TOKEN"] ?? "";
  let channelId =
    process.env["TASKORA_TASK_NOTIFY_CHANNEL_ID"] ??
    process.env["TASK_NOTIFY_CHANNEL_ID"] ??
    process.env["TASKORA_TASK_CHANNEL_ID"] ??
    "";
  if (!channelId) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "task_notify_channel")
        .maybeSingle();
      const v = (data?.value ?? {}) as { channel_id?: string; chat_id?: string };
      channelId = String(v.channel_id ?? v.chat_id ?? "").trim();
    } catch {}
  }
  return { botToken, channelId: String(channelId).trim() };
}

export async function getTaskNotifyChannelConfig(): Promise<{ channel_id: string }> {
  const { channelId } = await resolveTaskNotifyChannelId();
  return { channel_id: channelId };
}

export async function setTaskNotifyChannelConfig(channelId: string): Promise<{ channel_id: string }> {
  const id = String(channelId ?? "").trim();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("app_settings").upsert(
    { key: "task_notify_channel", value: { channel_id: id, chat_id: id } } as never,
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);
  return { channel_id: id };
}

export async function postTaskToNotifyChannel(opts: {
  title: string;
  reward: number;
  platform?: string | null;
  slots?: number | null;
  taskId?: string | null;
}) {
  try {
    const { botToken, channelId } = await resolveTaskNotifyChannelId();
    if (!botToken || !channelId) return;
    const platform = (opts.platform || "task").toString();
    const slots =
      opts.slots != null && Number(opts.slots) > 0
        ? `\nSlots: <b>${Number(opts.slots)}</b>`
        : "";
    const msg =
      `🆕 <b>NEW TASK LIVE</b>\n${esc(opts.title)}\nReward: <b>$${Number(opts.reward).toFixed(4)}</b> USDT\nPlatform: ${esc(platform)}${slots}` +
      (opts.taskId ? `\nRef: <code>${esc(String(opts.taskId).slice(0, 8))}</code>` : "") +
      `\nTime: ${new Date().toISOString()}`;
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: channelId,
        text: msg,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });
  } catch {}
}

export const ownerGetTaskNotifyChannel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertOwner } = await import("@/lib/owner-guard.server");
    await assertOwner(context.userId);
    return getTaskNotifyChannelConfig();
  });

export const ownerSetTaskNotifyChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { channelId: string }) => d)
  .handler(async ({ data, context }) => {
    const { assertOwner } = await import("@/lib/owner-guard.server");
    await assertOwner(context.userId);
    return setTaskNotifyChannelConfig(data.channelId);
  });

export async function getOpsChannelConfig(): Promise<{ channel_id: string }> {
  return { channel_id: await resolveOpsId() };
}

export async function setOpsChannelConfig(channelId: string): Promise<{ channel_id: string }> {
  const id = String(channelId ?? "").trim();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("app_settings").upsert(
    { key: "owner_ops_channel", value: { channel_id: id, chat_id: id } } as never,
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);
  return { channel_id: id };
}

export const ownerGetOpsChannel = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertOwner } = await import("@/lib/owner-guard.server");
    await assertOwner(context.userId);
    return getOpsChannelConfig();
  });

export const ownerSetOpsChannel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { channelId: string }) => d)
  .handler(async ({ data, context }) => {
    const { assertOwner } = await import("@/lib/owner-guard.server");
    await assertOwner(context.userId);
    return setOpsChannelConfig(data.channelId);
  });
