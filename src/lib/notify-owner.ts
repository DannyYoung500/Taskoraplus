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

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
const DEFAULT_PAYOUT_TEMPLATE = "✅ <b>PAYOUT COMPLETE</b>\\n\\nAmount: <b>#amount</b> USDT\\nNetwork: #method\\nUser: #name\\nUsername: #username\\nTo: <code>#address</code>\\nTx: <code>#tx_hash</code>\\nRef: <code>#reference</code>\\nTime: #time";

async function getPayoutProofSettings() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.from("payout_proof_settings").select("*").eq("id", true).maybeSingle();
  if (error) throw new Error(error.message);
  return (data ?? { channel_id: "", message_template: DEFAULT_PAYOUT_TEMPLATE, payout_image_url: null }) as any;
}
function normalizeTelegramChatRef(raw: string): string {
  let s = String(raw ?? "").trim();
  if (!s) return "";
  try {
    const lower = s.toLowerCase();
    const isLink = lower.startsWith("https://t.me/") || lower.startsWith("http://t.me/") ||
      lower.startsWith("https://telegram.me/") || lower.startsWith("http://telegram.me/") ||
      lower.startsWith("t.me/") || lower.startsWith("telegram.me/");
    if (isLink) {
      const u = new URL(s.startsWith("http") ? s : `https://${s}`);
      const path = u.pathname.split("/").filter(Boolean)[0] ?? "";
      if (path && !path.startsWith("+") && !path.startsWith("joinchat")) {
        s = path;
      }
    }
  } catch {}
  while (s.startsWith("@")) s = s.slice(1);
  if (s && (s.startsWith("-") || /^[0-9]+$/.test(s))) return s;
  return s ? `@${s}` : "";
}

function renderPayoutTemplate(template: string, values: Record<string,string>) {
  let result = template || DEFAULT_PAYOUT_TEMPLATE;
  for (const [key,value] of Object.entries(values)) result = result.split(key).join(value);
  return result.replace(/\\n/g, "\n");
}
export async function postPayoutProofToChannel(opts: { amount:number; method:string; address:string; txHash?:string|null; displayName?:string|null; username?:string|null; withdrawalId:string }) {
  try {
    const botToken = process.env["TELEGRAM_BOT_TOKEN"] ?? "";
    const settings = await getPayoutProofSettings();
    const channelId = normalizeTelegramChatRef(settings.channel_id || process.env["TASKORA_PAYOUT_CHANNEL_ID"] || process.env["PAYOUT_CHANNEL_ID"] || process.env["TASKORA_PAYMENT_CHANNEL_ID"] || "");
    if (!botToken || !channelId) return;
    const username = opts.username ? String(opts.username).replace(/^@/,"") : "";
    const tx = (opts.txHash ?? "").trim();
    const address = opts.address || "";
    const message = renderPayoutTemplate(settings.message_template || DEFAULT_PAYOUT_TEMPLATE, {
      "#amount": Number(opts.amount).toFixed(2), "#method": escapeHtml(opts.method || "USDT"),
      "#name": escapeHtml(opts.displayName || "Tasker"), "#username": username ? "@" + escapeHtml(username) : "No username",
      "#address": escapeHtml(address.length > 16 ? address.slice(0,8) + "…" + address.slice(-6) : address),
      "#tx_hash": tx ? escapeHtml(tx.slice(0,64)) : "Pending / not supplied",
      "#reference": escapeHtml(opts.withdrawalId.slice(0,8)), "#time": escapeHtml(new Date().toISOString()),
    });
    const explorer = tx && /^0x[a-fA-F0-9]{40,}$/.test(tx) ? `\\n<a href="https://etherscan.io/tx/${tx}">View on explorer</a>` : tx && /^[a-fA-F0-9]{64}$/.test(tx) ? `\\n<a href="https://tronscan.org/#/transaction/${tx}">View on Tronscan</a>` : "";
    const caption = message + explorer;
    if (settings.payout_image_url) {
      await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({chat_id:channelId,photo:settings.payout_image_url,caption:caption.slice(0,1024),parse_mode:"HTML"}) }).catch(()=>undefined);
    } else {
      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({chat_id:channelId,text:caption.slice(0,4096),parse_mode:"HTML",disable_web_page_preview:false}) }).catch(()=>undefined);
    }
    await sendOwnerHtml(`📢 Payout proof posted\\n$${Number(opts.amount).toFixed(2)} · ${opts.method} · ${username ? "@" + username : "no username"}`);
  } catch {}
}
export async function sendPayoutProofTest() {
  const botToken = process.env["TELEGRAM_BOT_TOKEN"] ?? "";
  const settings = await getPayoutProofSettings();
  const channelId = normalizeTelegramChatRef(settings.channel_id || process.env["TASKORA_PAYOUT_CHANNEL_ID"] || process.env["PAYOUT_CHANNEL_ID"] || process.env["TASKORA_PAYMENT_CHANNEL_ID"] || "");
  if (!botToken) throw new Error("Telegram bot token is not configured.");
  if (!channelId) throw new Error("Save a payout channel first.");
  const caption = renderPayoutTemplate(settings.message_template || DEFAULT_PAYOUT_TEMPLATE, {
    "#amount": "10.00", "#method": "USDT_TRC20", "#name": "TASKORA Test User",
    "#username": "@taskora_test", "#address": "TTestAddress1234567890",
    "#tx_hash": "TEST_TRANSACTION", "#reference": "TEST-PAYOUT", "#time": new Date().toISOString(),
  });
  const response = settings.payout_image_url
    ? await fetch(`https://api.telegram.org/bot${botToken}/sendPhoto`, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({chat_id:channelId,photo:settings.payout_image_url,caption:caption.slice(0,1024),parse_mode:"HTML"}) })
    : await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method:"POST", headers:{"content-type":"application/json"}, body:JSON.stringify({chat_id:channelId,text:caption.slice(0,4096),parse_mode:"HTML"}) });
  const result = await response.json() as any;
  if (!response.ok || !result.ok) throw new Error(result.description || "Telegram rejected the test payout.");
  return { ok:true, channel_id:channelId, message_id:result.result?.message_id ?? null, used_image:Boolean(settings.payout_image_url) };
}

export async function getPayoutChannelConfig() {
  const s = await getPayoutProofSettings();
  return { channel_id:s.channel_id??"", channel_username:s.channel_username??null, channel_title:s.channel_title??null, channel_description:s.channel_description??null, channel_photo_url:s.channel_photo_url??null, payout_image_url:s.payout_image_url??null, payout_image_file_name:s.payout_image_file_name??null, message_template:s.message_template || DEFAULT_PAYOUT_TEMPLATE };
}
export async function setPayoutChannelConfig(channelId:string) {
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  const normalized = normalizeTelegramChatRef(channelId); const {error}=await supabaseAdmin.from("payout_proof_settings").upsert({id:true,channel_id:normalized,updated_at:new Date().toISOString()},{onConflict:"id"});
  if(error) throw new Error(error.message); return getPayoutChannelConfig();
}
export async function refreshPayoutChannelPreview() {
  const botToken=process.env["TELEGRAM_BOT_TOKEN"]??""; const current=await getPayoutProofSettings();
  if(!botToken || !current.channel_id) throw new Error("Set the Telegram channel ID or @username first.");
  const chatRef = normalizeTelegramChatRef(current.channel_id); if (!chatRef) throw new Error("Set a Telegram channel @username or numeric chat ID first."); const chatRes=await fetch(`https://api.telegram.org/bot${botToken}/getChat?chat_id=${encodeURIComponent(chatRef)}`);
  const chatJson=await chatRes.json() as any;
  if(!chatJson.ok || !chatJson.result) throw new Error(chatJson.description || "Telegram could not load that channel.");
  let photoUrl=current.channel_photo_url??null; const smallFileId=chatJson.result?.photo?.small_file_id;
  if(smallFileId){
    const fileJson=await (await fetch(`https://api.telegram.org/bot${botToken}/getFile?file_id=${encodeURIComponent(smallFileId)}`)).json() as any;
    const filePath=fileJson.result?.file_path;
    if(fileJson.ok && filePath){
      const imageRes=await fetch(`https://api.telegram.org/file/bot${botToken}/${filePath}`);
      if(imageRes.ok){
        const bytes=await imageRes.arrayBuffer(); const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
        const path=`channel-avatar-${Date.now()}.jpg`;
        const upload=await supabaseAdmin.storage.from("payout-proofs").upload(path,bytes,{contentType:imageRes.headers.get("content-type")||"image/jpeg",upsert:true});
        if(!upload.error) photoUrl=supabaseAdmin.storage.from("payout-proofs").getPublicUrl(path).data.publicUrl;
      }
    }
  }
  const result={channel_id:chatRef,channel_username:chatJson.result.username?"@"+chatJson.result.username:null,channel_title:chatJson.result.title??chatJson.result.first_name??null,channel_description:chatJson.result.description??null,channel_photo_file_id:smallFileId??current.channel_photo_file_id??null,channel_photo_url:photoUrl,payout_image_url:current.payout_image_url??null,payout_image_file_name:current.payout_image_file_name??null,message_template:current.message_template||DEFAULT_PAYOUT_TEMPLATE,updated_at:new Date().toISOString()};
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server"); const {error}=await supabaseAdmin.from("payout_proof_settings").upsert({id:true,...result},{onConflict:"id"}); if(error) throw new Error(error.message); return result;
}
export async function setPayoutPresentation(opts:{messageTemplate:string;imageDataUrl?:string;imageFileName?:string}) {
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server"); let imageUrl:string|null=null;
  if(opts.imageDataUrl?.trim()){
    const match=opts.imageDataUrl.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/); if(!match) throw new Error("Payout image must be PNG, JPG or WebP.");
    if(match[2]!.length>4500000) throw new Error("Payout image is too large. Keep it under about 3 MB.");
    const bytes=Uint8Array.from(atob(match[2]!),c=>c.charCodeAt(0)); const ext=match[1]==="image/png"?"png":match[1]==="image/webp"?"webp":"jpg"; const path=`payout-${Date.now()}.${ext}`;
    const upload=await supabaseAdmin.storage.from("payout-proofs").upload(path,bytes,{contentType:match[1]!,upsert:true}); if(upload.error) throw new Error(upload.error.message);
    imageUrl=supabaseAdmin.storage.from("payout-proofs").getPublicUrl(path).data.publicUrl;
  }
  const next:any={message_template:String(opts.messageTemplate||DEFAULT_PAYOUT_TEMPLATE).slice(0,3800),updated_at:new Date().toISOString()};
  if(imageUrl) Object.assign(next,{payout_image_url:imageUrl,payout_image_file_name:String(opts.imageFileName||"payout-proof").slice(0,120)});
  const {error}=await supabaseAdmin.from("payout_proof_settings").upsert({id:true,...next},{onConflict:"id"}); if(error) throw new Error(error.message); return getPayoutChannelConfig();
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
