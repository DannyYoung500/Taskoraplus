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

export async function sendOwnerHtml(msg: string) {
  const { botToken, ownerIds } = await ownerChatIds();
  if (!botToken || !ownerIds.length) return;
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

/** Notify TASKORA owners when a new Mini App user joins. Never throws. */
export async function notifyOwnersNewUser(opts: {
  displayName: string;
  username?: string | null;
  telegramId: number;
}) {
  try {
    const uname = opts.username ? `@${opts.username}` : "no username";
    const msg =
      `🆕 <b>New TASKORA user</b>\n` +
      `Name: ${opts.displayName}\n` +
      `Telegram: ${uname}\n` +
      `ID: <code>${opts.telegramId}</code>\n` +
      `Time: ${new Date().toISOString()}`;
    await sendOwnerHtml(msg);
  } catch {
    /* never block login */
  }
}

/** Alert owners when a large / dual-approval withdrawal is requested. Never throws. */
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
    const msg =
      `💸 <b>Withdrawal request</b>${dual}\n` +
      `User: ${opts.displayName ?? opts.userId.slice(0, 8)}\n` +
      `Amount: <b>$${Number(opts.amount).toFixed(2)}</b>\n` +
      `Method: ${opts.method}\n` +
      `Address: <code>${opts.address.slice(0, 36)}${opts.address.length > 36 ? "…" : ""}</code>\n` +
      `Time: ${new Date().toISOString()}`;
    await sendOwnerHtml(msg);
  } catch {
    /* never block withdrawal */
  }
}

/** Resolve public payout proof channel (env or app_settings.payout_channel). */
async function resolvePayoutChannelId(): Promise<{ botToken: string; channelId: string }> {
  const botToken = process.env["TELEGRAM_BOT_TOKEN"] ?? "";
  let channelId =
    process.env["TASKORA_PAYOUT_CHANNEL_ID"] ??
    process.env["PAYOUT_CHANNEL_ID"] ??
    process.env["TASKORA_PAYMENT_CHANNEL_ID"] ??
    "";
  if (!channelId) {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "payout_channel")
        .maybeSingle();
      const v = (data?.value ?? {}) as { channel_id?: string; chat_id?: string };
      channelId = String(v.channel_id ?? v.chat_id ?? "").trim();
    } catch {
      /* */
    }
  }
  return { botToken, channelId: String(channelId).trim() };
}

/**
 * Post public payout proof to the owner payment channel.
 * Called when a withdrawal is marked paid. Never throws.
 */
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
    const { botToken, channelId } = await resolvePayoutChannelId();
    if (!botToken || !channelId) return;

    const uname = opts.username ? `@${String(opts.username).replace(/^@/, "")}` : null;
    const who = opts.displayName || uname || "Tasker";
    const addr = opts.address || "";
    const shortAddr =
      addr.length > 16 ? `${addr.slice(0, 8)}…${addr.slice(-6)}` : addr;
    const tx = (opts.txHash ?? "").trim();
    const txLine = tx
      ? `\nTx: <code>${tx.slice(0, 64)}${tx.length > 64 ? "…" : ""}</code>`
      : "";
    const explorer =
      tx && /^0x[a-fA-F0-9]{40,}$/.test(tx)
        ? `\n<a href="https://etherscan.io/tx/${tx}">View on explorer</a>`
        : tx && /^[a-fA-F0-9]{64}$/.test(tx)
          ? `\n<a href="https://tronscan.org/#/transaction/${tx}">View on Tronscan</a>`
          : "";

    const msg =
      `✅ <b>PAYOUT COMPLETE</b>\n` +
      `Amount: <b>$${Number(opts.amount).toFixed(2)}</b> USDT\n` +
      `Network: ${opts.method || "USDT"}\n` +
      `To: <code>${shortAddr}</code>\n` +
      `User: ${who}` +
      (uname && opts.displayName ? ` (${uname})` : "") +
      txLine +
      explorer +
      `\nRef: <code>${opts.withdrawalId.slice(0, 8)}</code>\n` +
      `Time: ${new Date().toISOString()}`;

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: channelId,
        text: msg,
        parse_mode: "HTML",
        disable_web_page_preview: false,
      }),
    }).catch(() => undefined);

    // Also ping owners so they see it landed
    await sendOwnerHtml(
      `📢 Payout proof posted to channel\n$${Number(opts.amount).toFixed(2)} · ${opts.method}\n${tx ? `Tx ${tx.slice(0, 20)}…` : "No tx hash"}`,
    );
  } catch {
    /* never block mark-paid */
  }
}

/** Owner sets / reads the public payout proof channel id. */
export async function getPayoutChannelConfig(): Promise<{ channel_id: string }> {
  const fromEnv =
    process.env["TASKORA_PAYOUT_CHANNEL_ID"] ??
    process.env["PAYOUT_CHANNEL_ID"] ??
    process.env["TASKORA_PAYMENT_CHANNEL_ID"] ??
    "";
  if (fromEnv.trim()) return { channel_id: fromEnv.trim() };
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "payout_channel")
      .maybeSingle();
    const v = (data?.value ?? {}) as { channel_id?: string; chat_id?: string };
    return { channel_id: String(v.channel_id ?? v.chat_id ?? "").trim() };
  } catch {
    return { channel_id: "" };
  }
}

/** Owner persists payout proof channel id into app_settings. */
export async function setPayoutChannelConfig(channelId: string): Promise<{ channel_id: string }> {
  const id = String(channelId ?? "").trim();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.from("app_settings").upsert(
    { key: "payout_channel", value: { channel_id: id, chat_id: id } } as never,
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);
  return { channel_id: id };
}

/** Velocity / rate-limit alert to owners. Never throws. */
export async function notifyOwnersVelocityAlert(opts: {
  userId: string;
  kind: "submissions" | "withdrawals";
  count: number;
  limit: number;
  displayName?: string | null;
}) {
  try {
    const label = opts.kind === "submissions" ? "submissions / hour" : "WD requests / 24h";
    const msg =
      `⚡ <b>Velocity alert</b>\n` +
      `User: ${opts.displayName ?? opts.userId.slice(0, 8)}\n` +
      `Hit <b>${opts.count}/${opts.limit}</b> ${label}\n` +
      `ID: <code>${opts.userId.slice(0, 12)}</code>\n` +
      `Time: ${new Date().toISOString()}`;
    await sendOwnerHtml(msg);
  } catch {
    /* never block */
  }
}
