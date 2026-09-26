async function ownerChatIds(): Promise<{ token: string; owners: string[] }> {
  return {
    token: process.env["TELEGRAM_BOT_TOKEN"] ?? "",
    owners: String(process.env["TASKORA_OWNER_TELEGRAM_IDS"] ?? process.env["OWNER_TELEGRAM_IDS"] ?? "").split(",").map(x => x.trim()).filter(Boolean),
  };
}
function esc(v: unknown) { return String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
export async function sendOwnerHtml(msg: string) {
  const { token, owners } = await ownerChatIds();
  if (!token || !owners.length) return;
  await Promise.all(owners.map(chat_id => fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id, text: msg, parse_mode: "HTML", disable_web_page_preview: true }) }).catch(() => undefined)));
}
export const notifyOwnersNewUser = async (o: { displayName: string; username?: string | null; telegramId: number }) => sendOwnerHtml(`🆕 <b>New TaskoraPlus User</b>\\n👤 Name: ${esc(o.displayName)}\\n📱 Telegram: ${o.username ? "@" + esc(o.username) : "No username"}\\n🆔 ID: <code>${o.telegramId}</code>`);
export const notifyOwnersWithdrawalRequested = async (o: { userId: string; amount: number; method: string; address: string; displayName?: string | null; reference?: string | null }) => sendOwnerHtml(`🔔 <b>New Withdrawal</b>\\n👤 User: ${esc(o.displayName ?? o.userId.slice(0, 8))}\\n💰 Amount: <b>$${Number(o.amount).toFixed(2)}</b>\\n📍 Network: ${esc(o.method)}\\n💳 Wallet: <code>${esc(o.address.slice(0, 18))}…</code>\\n🧾 Ref: <code>${esc(o.reference ?? "—")}</code>`);
export const notifyOwnersWithdrawalPaid = async (o: { userId: string; amount: number; method: string; txHash?: string | null; reference?: string | null; displayName?: string | null }) => sendOwnerHtml(`✅ <b>Withdrawal Paid</b>\\n👤 User: ${esc(o.displayName ?? o.userId.slice(0, 8))}\\n💰 Amount: <b>$${Number(o.amount).toFixed(2)}</b>\\n📍 Network: ${esc(o.method)}\\n🔗 Tx: <code>${esc(o.txHash ?? "—")}</code>\\n🧾 Ref: <code>${esc(o.reference ?? "—")}</code>`);
export const notifyOwnersWithdrawalFailed = async (o: { userId: string; amount: number; method: string; reason: string; reference?: string | null; displayName?: string | null }) => sendOwnerHtml(`❌ <b>Withdrawal Failed</b>\\n👤 User: ${esc(o.displayName ?? o.userId.slice(0, 8))}\\n💰 Amount: <b>$${Number(o.amount).toFixed(2)}</b>\\n📍 Network: ${esc(o.method)}\\n📝 Reason: ${esc(o.reason)}\\n🧾 Ref: <code>${esc(o.reference ?? "—")}</code>`);
export const notifyOwnersLargeWithdrawal = async (o: { userId: string; amount: number; method: string; address: string; requiresDual: boolean; displayName?: string | null }) => sendOwnerHtml(`💸 <b>Withdrawal Request</b>${o.requiresDual ? " · <b>DUAL APPROVAL</b>" : ""}\\n👤 User: ${esc(o.displayName ?? o.userId.slice(0, 8))}\\n💰 Amount: <b>$${Number(o.amount).toFixed(2)}</b>\\n📍 Network: ${esc(o.method)}\\n💳 Wallet: <code>${esc(o.address.slice(0, 36))}${o.address.length > 36 ? "…" : ""}</code>`);
export const notifyOwnersVelocityAlert = async (o: { userId: string; kind: "submissions" | "withdrawals"; count: number; limit: number; displayName?: string | null }) => sendOwnerHtml(`⚡ <b>Velocity Alert</b>\\n👤 User: ${esc(o.displayName ?? o.userId.slice(0, 8))}\\n📊 Hit <b>${o.count}/${o.limit}</b> ${o.kind === "submissions" ? "submissions / hour" : "WD requests / 24h"}`);
