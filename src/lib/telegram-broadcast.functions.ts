import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Audience = "all_active" | "all_telegram";
type MediaType = "none" | "image" | "video" | "document" | "audio" | "voice";
type BroadcastButton = { text: string; url: string };
type BroadcastInput = {
  title: string; body: string; mediaUrl?: string; mediaType?: MediaType;
  buttonText?: string; buttonUrl?: string; buttons?: BroadcastButton[];
  audience?: Audience; countryCodes?: string[]; scheduledAt?: string;
  disableNotification?: boolean; protectContent?: boolean; saveDraft?: boolean;
};

async function ownerContext(userId: string) {
  const { assertOwner, admin, audit } = await import("@/lib/owner-guard.server");
  await assertOwner(userId);
  return { db: await admin(), audit };
}

function validateUrl(value?: string) {
  return !value || /^https?:\/\//i.test(value.trim());
}

function normalizeButtons(input?: BroadcastButton[], legacyText?: string, legacyUrl?: string) {
  const source = input?.length ? input : legacyText && legacyUrl ? [{ text: legacyText, url: legacyUrl }] : [];
  return source.map((b) => ({ text: String(b.text || "").trim(), url: String(b.url || "").trim() }))
    .filter((b) => b.text && /^https?:\/\//i.test(b.url)).slice(0, 6);
}
function normalizeCountries(input?: string[]) { return [...new Set((input || []).map((x) => x.trim().toUpperCase()).filter(Boolean))].slice(0, 50); }
function appUrl() { const v=String(process.env.PUBLIC_APP_URL||"").trim().replace(/\/$/,""); return v || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : ""); }
function trackedUrl(url:string,b?:string,r?:string,i?:number){const base=appUrl();return base&&b&&r&&i!==undefined?`${base}/api/telegram/broadcast/click?b=${encodeURIComponent(b)}&r=${encodeURIComponent(r)}&i=${i}&u=${encodeURIComponent(url)}`:url;}

async function telegramSend(token: string, chatId: number, input: {
  body: string; mediaUrl?: string; mediaType?: MediaType; buttons?: BroadcastButton[];
  broadcastId?: string; recipientId?: string; disableNotification?: boolean; protectContent?: boolean;
}) {
  const bs=normalizeButtons(input.buttons).map((b,i)=>({text:b.text,url:trackedUrl(b.url,input.broadcastId,input.recipientId,i)}));
  const rows:any[]=[]; for(let i=0;i<bs.length;i+=2) rows.push(bs.slice(i,i+2));
  const type=input.mediaType||"none";
  const endpoint=type==="image"?"sendPhoto":type==="video"?"sendVideo":type==="document"?"sendDocument":type==="audio"?"sendAudio":type==="voice"?"sendVoice":"sendMessage";
  const key:any={image:"photo",video:"video",document:"document",audio:"audio",voice:"voice"}[type];
  const payload:any={chat_id:chatId,parse_mode:"HTML",link_preview_options:{is_disabled:true},reply_markup:bs.length?{inline_keyboard:rows}:undefined,disable_notification:!!input.disableNotification,protect_content:!!input.protectContent};
  if(key&&input.mediaUrl){payload[key]=input.mediaUrl;payload.caption=input.body;}else payload.text=input.body;
  const response=await fetch(`https://api.telegram.org/bot${token}/${endpoint}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
  const result=await response.json() as {ok?:boolean;description?:string;parameters?:{retry_after?:number}};
  return {response,result};
}

export const listTelegramBroadcasts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await ownerContext(context.userId);
    const { data, error } = await db
      .from("telegram_broadcasts")
      .select("id,title,body,media_url,media_type,buttons,button_text,button_url,audience,country_codes,status,total_recipients,sent_count,failed_count,blocked_count,click_count,disable_notification,protect_content,scheduled_at,created_at,started_at,completed_at,last_error")
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createTelegramBroadcast = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).inputValidator((d: BroadcastInput) => d)
  .handler(async ({ data, context }) => {
    const { db, audit } = await ownerContext(context.userId);
    const title=data.title.trim(), body=data.body.trim(), mediaUrl=data.mediaUrl?.trim()||"";
    const mediaType=data.mediaType??(mediaUrl?"image":"none"), buttons=normalizeButtons(data.buttons,data.buttonText,data.buttonUrl);
    const audience=data.audience??"all_active", countryCodes=normalizeCountries(data.countryCodes);
    const scheduledAt=data.scheduledAt?new Date(data.scheduledAt).toISOString():null;
    if(!title||!body)throw new Error("Title and message are required.");
    if(body.length>4096)throw new Error("Telegram message text must be 4096 characters or fewer.");
    if(mediaType!=="none"&&!mediaUrl)throw new Error("Media is required for the selected media type.");
    if(!validateUrl(mediaUrl)||buttons.some(b=>!validateUrl(b.url)))throw new Error("URLs must start with http:// or https://.");
    const {data:profiles,error:pe}=await db.from("profiles").select("telegram_id,account_status,status,country_code").not("telegram_id","is",null);
    if(pe)throw new Error(pe.message);
    const cc=new Set(countryCodes);
    const ids=(profiles??[]).filter((p:any)=>(audience==="all_telegram"||(p.account_status!=="blocked"&&p.status!=="blocked"))&&(!cc.size||cc.has(String(p.country_code??"").toUpperCase()))).map((p:any)=>Number(p.telegram_id)).filter(Number.isFinite);
    const draft=Boolean(data.saveDraft);
    if(!draft&&!ids.length)throw new Error("No eligible Telegram users are available for this audience.");
    const {data:broadcast,error}=await db.from("telegram_broadcasts").insert({
      title,body,media_url:mediaUrl||null,media_type:mediaType,buttons,button_text:buttons[0]?.text||null,button_url:buttons[0]?.url||null,
      audience,country_codes:countryCodes,status:draft?"draft":"queued",total_recipients:ids.length,scheduled_at:scheduledAt,
      disable_notification:Boolean(data.disableNotification),protect_content:Boolean(data.protectContent),created_by:context.userId,
    }).select("id,*").single();
    if(error)throw new Error(error.message);
    if(!draft){const {error:re}=await db.from("telegram_broadcast_recipients").insert(ids.map(telegram_id=>({broadcast_id:broadcast.id,telegram_id})));if(re){await db.from("telegram_broadcasts").delete().eq("id",broadcast.id);throw new Error(re.message);}}
    await audit({adminId:context.userId,action:draft?"telegram_broadcast.draft_create":"telegram_broadcast.create",targetType:"telegram_broadcast",targetId:broadcast.id,next:{audience,countries:countryCodes,recipients:ids.length}});
    return broadcast;
  });

export const publishTelegramBroadcast = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:{broadcastId:string})=>d)
.handler(async({data,context})=>{const {db}=await ownerContext(context.userId);const {data:b,error}=await db.from("telegram_broadcasts").select("*").eq("id",data.broadcastId).single();if(error||!b)throw new Error("Broadcast not found.");if(b.status!=="draft")throw new Error("Only drafts can be published.");const {data:ps}=await db.from("profiles").select("telegram_id,account_status,status,country_code").not("telegram_id","is",null);const cc=new Set<string>(b.country_codes??[]);const ids=(ps??[]).filter((p:any)=>(b.audience==="all_telegram"||(p.account_status!=="blocked"&&p.status!=="blocked"))&&(!cc.size||cc.has(String(p.country_code??"").toUpperCase()))).map((p:any)=>Number(p.telegram_id)).filter(Number.isFinite);if(!ids.length)throw new Error("No eligible Telegram users are available.");await db.from("telegram_broadcast_recipients").insert(ids.map((telegram_id)=>({broadcast_id:b.id,telegram_id})));const {data:u,error:ue}=await db.from("telegram_broadcasts").update({status:"queued",total_recipients:ids.length}).eq("id",b.id).select("*").single();if(ue)throw new Error(ue.message);return u;});

export const uploadTelegramBroadcastMedia = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:{name:string;type:string;data:string})=>d)
.handler(async({data,context})=>{await ownerContext(context.userId);const mime=data.type.toLowerCase();const mediaType:MediaType=mime.startsWith("image/")?"image":mime.startsWith("video/")?"video":mime.startsWith("audio/")?"audio":"document";const bytes=Uint8Array.from(atob(data.data),c=>c.charCodeAt(0));const max=mediaType==="image"?10*1024*1024:50*1024*1024;if(!bytes.length||bytes.length>max)throw new Error(`Media exceeds the ${max/1024/1024}MB limit.`);const {supabaseAdmin}=await import("@/integrations/supabase/client.server");const safe=data.name.replace(/[^a-zA-Z0-9._-]/g,"_");const path=`broadcasts/${context.userId}/${crypto.randomUUID()}-${safe}`;const {error}=await supabaseAdmin.storage.from("telegram-broadcast-media").upload(path,bytes,{contentType:mime,upsert:false});if(error)throw new Error(error.message);const {data:p}=supabaseAdmin.storage.from("telegram-broadcast-media").getPublicUrl(path);return{url:p.publicUrl,mediaType};});

export const sendTelegramBroadcastTest = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:BroadcastInput)=>d)
.handler(async({data,context})=>{const {db}=await ownerContext(context.userId);const token=(process.env.TELEGRAM_BOT_TOKEN||"").trim();if(!token)throw new Error("TELEGRAM_BOT_TOKEN is not configured.");const {data:p}=await db.from("profiles").select("telegram_id").eq("id",context.userId).maybeSingle();const chatId=Number(p?.telegram_id);if(!Number.isFinite(chatId))throw new Error("Your owner account is not linked to a Telegram chat.");const {response,result}=await telegramSend(token,chatId,{body:data.body.trim(),mediaUrl:data.mediaUrl?.trim()||undefined,mediaType:data.mediaType,buttons:normalizeButtons(data.buttons,data.buttonText,data.buttonUrl),disableNotification:data.disableNotification,protectContent:data.protectContent});if(!response.ok||!result.ok)throw new Error(result.description||"Telegram rejected the test message.");return{ok:true};});

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
          mediaType: broadcast.media_type ?? "none",
          buttons: normalizeButtons(broadcast.buttons, broadcast.button_text ?? undefined, broadcast.button_url ?? undefined),
          broadcastId: broadcast.id,
          recipientId: recipient.id,
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

export const listTelegramBroadcastTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { db } = await ownerContext(context.userId);
    const { data, error } = await db.from("telegram_broadcast_templates").select("*").eq("created_by", context.userId).order("updated_at", { ascending: false }).limit(50);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const saveTelegramBroadcastTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: any) => d)
  .handler(async ({ data, context }) => {
    const { db } = await ownerContext(context.userId);
    const name = String(data.name || "").trim();
    if (!name) throw new Error("Template name is required.");
    const buttons = normalizeButtons(data.buttons, data.buttonText, data.buttonUrl);
    const { data: template, error } = await db.from("telegram_broadcast_templates").upsert({
      name, title: String(data.title || "").trim(), body: String(data.body || "").trim(),
      media_url: data.mediaUrl || null, media_type: data.mediaType || "none", buttons,
      disable_notification: Boolean(data.disableNotification), protect_content: Boolean(data.protectContent),
      created_by: context.userId,
    }, { onConflict: "created_by,name" }).select("*").single();
    if (error) throw new Error(error.message);
    return template;
  });

export const deleteTelegramBroadcastTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    const { db } = await ownerContext(context.userId);
    const { error } = await db.from("telegram_broadcast_templates").delete().eq("id", data.id).eq("created_by", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getTelegramBroadcastAnalytics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { broadcastId: string }) => d)
  .handler(async ({ data, context }) => {
    const { db } = await ownerContext(context.userId);
    const { count } = await db.from("telegram_broadcast_clicks").select("id", { count: "exact", head: true }).eq("broadcast_id", data.broadcastId);
    const { data: rows } = await db.from("telegram_broadcast_clicks").select("button_index").eq("broadcast_id", data.broadcastId);
    const byButton = new Map<number, number>();
    for (const row of rows ?? []) byButton.set(Number(row.button_index), (byButton.get(Number(row.button_index)) ?? 0) + 1);
    return { clicks: count ?? 0, byButton: [...byButton.entries()].map(([buttonIndex, value]) => ({ buttonIndex, count: value })) };
  });
