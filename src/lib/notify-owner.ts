/** Notify TASKORA owners when a new Mini App user joins. Never throws. */
export async function notifyOwnersNewUser(opts: {
  displayName: string;
  username?: string | null;
  telegramId: number;
}) {
  try {
    const botToken = process.env["TELEGRAM_BOT_TOKEN"] ?? "";
    const ownerIds = String(
      process.env["TASKORA_OWNER_TELEGRAM_IDS"] ?? process.env["OWNER_TELEGRAM_IDS"] ?? "",
    )
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!botToken || !ownerIds.length) return;
    const uname = opts.username ? `@${opts.username}` : "no username";
    const msg =
      `🆕 <b>New TASKORA user</b>\n` +
      `Name: ${opts.displayName}\n` +
      `Telegram: ${uname}\n` +
      `ID: <code>${opts.telegramId}</code>\n` +
      `Time: ${new Date().toISOString()}`;
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
  } catch {
    /* never block login */
  }
}
