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

async function sendOwnerHtml(msg: string) {
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
