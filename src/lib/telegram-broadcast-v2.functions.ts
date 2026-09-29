import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type MediaType = "none" | "image" | "video" | "document" | "audio" | "voice";
type Button = { text: string; url: string };
type Input = {
  title:string; body:string; mediaUrl?:string; mediaType?:MediaType; buttons?:Button[];
  audience?:"all_active"|"all_telegram"; countryCodes?:string[]; scheduledAt?:string;
  disableNotification?:boolean; protectContent?:boolean; saveDraft?:boolean;
};

async function ctx(userId:string) {
  const {assertOwner,admin,audit}=await import("@/lib/owner-guard.server");
  await assertOwner(userId); return {db:await admin(),audit};
}
const buttons=(v?:Button[])=> (v??[]).map(x=>({text:String(x.text||"").trim(),url:String(x.url||"").trim()}))
  .filter(x=>x.text&&/^https?:\\/\\//i.test(x.url)).slice(0,6);
const countries=(v?:string[])=>[...new Set((v??[]).map(x=>x.trim().toUpperCase()).filter(Boolean))].slice(0,50);
const validDate=(v?:string)=>!v||Number.isFinite(Date.parse(v));

async function ids(db:any,audience:string,countryCodes:string[]) {
  const {data,error}=await db.from("profiles").select("telegram_id,account_status,status,country_code").not("telegram_id","is",null);
  if(error)throw new Error(error.message);
  const cc=new Set(countryCodes);
  return (data??[]).filter((p:any)=>(audience==="all_telegram"|| (p.account_status!=="blocked"&&p.status!=="blocked"))&&(!cc.size||cc.has(String(p.country_code??"").toUpperCase())))
    .map((p:any)=>Number(p.telegram_id)).filter(Number.isFinite);
}
async function recipients(db:any,id:string,audience:string,cc:string[]) {
  const list=await ids(db,audience,cc); if(!list.length)throw new Error("No eligible Telegram users are available for this audience.");
  const {error}=await db.from("telegram_broadcast_recipients").upsert(list.map(telegram_id=>({broadcast_id:id,telegram_id})),{onConflict:"broadcast_id,telegram_id",ignoreDuplicates:true});
  if(error)throw new Error(error.message); await db.from("telegram_broadcasts").update({total_recipients:list.length}).eq("id",id); return list.length;
}
function appUrl(){return String(process.env.PUBLIC_APP_URL||"").replace(/\\/$/,"")||(`${process.env.VERCEL_URL?"https://"+process.env.VERCEL_URL:""}`);}
function track(url:string,b:string,r:string,i:number){const base=appUrl();return base?`${base}/api/telegram/broadcast/click?b=${encodeURIComponent(b)}&r=${encodeURIComponent(r)}&i=${i}&u=${encodeURIComponent(url)}`:url;}

async function send(token:string,chatId:number,x:any) {
  const bs=buttons(x.buttons).map((b,i)=>({text:b.text,url:x.broadcastId&&x.recipientId?track(b.url,x.broadcastId,x.recipientId,i):b.url}));
  const rows:any[]=[]; for(let i=0;i<bs.length;i+=2)rows.push(bs.slice(i,i+2));
  const type:MediaType=x.mediaType||"none";
  const endpoint=type==="image"?"sendPhoto":type==="video"?"sendVideo":type==="document"?"sendDocument":type==="audio"?"sendAudio":type==="voice"?"sendVoice":"sendMessage";
  const key:any={image:"photo",video:"video",document:"document",audio:"audio",voice:"voice"}[type];
  const payload:any={chat_id:chatId,parse_mode:"HTML",reply_markup:bs.length?{inline_keyboard:rows}:undefined,disable_notification:!!x.disableNotification,protect_content:!!x.protectContent};
  if(key&&x.mediaUrl){payload[key]=x.mediaUrl;payload.caption=x.body;}else payload.text=x.body;
  const response=await fetch(`https://api.telegram.org/bot${token}/${endpoint}`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(payload)});
  const result=await response.json() as any; return {response,result};
}

export const listBroadcasts=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const {db}=await ctx(context.userId);const {data,error}=await db.from("telegram_broadcasts").select("id,title,body,media_url,media_type,buttons,audience,country_codes,status,total_recipients,sent_count,failed_count,blocked_count,click_count,disable_notification,protect_content,scheduled_at,created_at,started_at,completed_at,last_error").order("created_at",{ascending:false}).limit(40);
  if(error)throw new Error(error.message);return data??[];
});

export const createBroadcast=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:Input)=>d).handler(async({data,context})=>{
  const {db,audit}=await ctx(context.userId);const mediaUrl=String(data.mediaUrl||"").trim();const type=data.mediaType||"none";const bs=buttons(data.buttons);const cc=countries(data.countryCodes);const scheduled=data.scheduledAt?new Date(data.scheduledAt).toISOString():null;
  if(!data.title.trim()||!data.body.trim())throw new Error("Title and message are required.");
  if(data.body.trim().length>4096)throw new Error("Telegram message text must be 4096 characters or fewer.");
  if(!validDate(scheduled))throw new Error("Invalid schedule time."); if(type!=="none"&&!mediaUrl)throw new Error("Media is required for the selected media type.");
  const {data:b,error}=await db.from("telegram_broadcasts").insert({title:data.title.trim(),body:data.body.trim(),media_url:mediaUrl||null,media_type:type,buttons:bs,audience:data.audience||"all_active",country_codes:cc,status:data.saveDraft?"draft":"queued",scheduled_at:scheduled,disable_notification:!!data.disableNotification,protect_content:!!data.protectContent,created_by:context.userId}).select("*").single();
  if(error)throw new Error(error.message); if(!data.saveDraft)await recipients(db,b.id,b.audience,cc);
  await audit({adminId:context.userId,action:data.saveDraft?"telegram_broadcast.draft":"telegram_broadcast.create",targetType:"telegram_broadcast",targetId:b.id,next:{audience:b.audience,countries:cc,scheduledAt:scheduled}});
  return b;
});

export const publishDraft=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:{id:string})=>d).handler(async({data,context})=>{
  const {db}=await ctx(context.userId);const {data:b,error}=await db.from("telegram_broadcasts").select("*").eq("id",data.id).single();if(error||!b)throw new Error("Broadcast not found.");
  if(b.status!=="draft")throw new Error("Only drafts can be published.");await recipients(db,b.id,b.audience,b.country_codes??[]);
  const {data:u,error:e}=await db.from("telegram_broadcasts").update({status:"queued"}).eq("id",b.id).select("*").single();if(e)throw new Error(e.message);return u;
});

export const uploadMedia=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:{name:string,type:string,data:string})=>d).handler(async({data,context})=>{
  await ctx(context.userId);const mime=data.type.toLowerCase();const type:MediaType=mime.startsWith("image/")?"image":mime.startsWith("video/")?"video":mime.startsWith("audio/")?"audio":"document";
  const bytes=Uint8Array.from(atob(data.data),(c)=>c.charCodeAt(0));const max=type==="image"?10*1024*1024:50*1024*1024;if(!bytes.length||bytes.length>max)throw new Error(`File exceeds the ${max/1024/1024}MB limit.`);
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");const bucket="telegram-broadcast-media";const safe=data.name.replace(/[^a-zA-Z0-9._-]/g,"_");const path=`broadcasts/${context.userId}/${crypto.randomUUID()}-${safe}`;
  const {error}=await supabaseAdmin.storage.from(bucket).upload(path,bytes,{contentType:mime,upsert:false});if(error)throw new Error(error.message);const {data:p}=supabaseAdmin.storage.from(bucket).getPublicUrl(path);return {url:p.publicUrl,mediaType:type};
});

export const templates=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{const {db}=await ctx(context.userId);const {data,error}=await db.from("telegram_broadcast_templates").select("*").eq("created_by",context.userId).order("updated_at",{ascending:false});if(error)throw new Error(error.message);return data??[];});
export const saveTemplate=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:any)=>d).handler(async({data,context})=>{const {db}=await ctx(context.userId);if(!String(data.name||"").trim())throw new Error("Template name is required.");const {data:t,error}=await db.from("telegram_broadcast_templates").upsert({name:data.name.trim(),title:data.title.trim(),body:data.body.trim(),media_url:data.mediaUrl||null,media_type:data.mediaType||"none",buttons:buttons(data.buttons),disable_notification:!!data.disableNotification,protect_content:!!data.protectContent,created_by:context.userId},{onConflict:"created_by,name"}).select("*").single();if(error)throw new Error(error.message);return t;});
export const deleteTemplate=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:{id:string})=>d).handler(async({data,context})=>{const {db}=await ctx(context.userId);const {error}=await db.from("telegram_broadcast_templates").delete().eq("id",data.id).eq("created_by",context.userId);if(error)throw new Error(error.message);return{ok:true};});

export const testBroadcast=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:Input)=>d).handler(async({data,context})=>{
  const {db}=await ctx(context.userId);const token=String(process.env.TELEGRAM_BOT_TOKEN||"");if(!token)throw new Error("TELEGRAM_BOT_TOKEN is not configured.");const {data:p}=await db.from("profiles").select("telegram_id").eq("id",context.userId).maybeSingle();const chatId=Number(p?.telegram_id);if(!Number.isFinite(chatId))throw new Error("Your owner account is not linked to Telegram.");
  const {response,result}=await send(token,chatId,{body:data.body.trim(),mediaUrl:data.mediaUrl,mediaType:data.mediaType,buttons:data.buttons,disableNotification:data.disableNotification,protectContent:data.protectContent});if(!response.ok||!result.ok)throw new Error(result.description||"Telegram rejected the test message.");return{ok:true};
});

async function processOne(db:any,token:string,id:string){
  const {data:b,error}=await db.from("telegram_broadcasts").select("*").eq("id",id).single();if(error||!b)throw new Error("Broadcast not found.");if(b.status==="completed"||b.status==="draft")return b;if(b.scheduled_at&&Date.parse(b.scheduled_at)>Date.now())return b;
  await db.from("telegram_broadcasts").update({status:"sending",started_at:b.started_at||new Date().toISOString(),last_error:null}).eq("id",id);
  const {data:rs,error:re}=await db.from("telegram_broadcast_recipients").select("id,telegram_id,attempts").eq("broadcast_id",id).eq("status","pending").or("next_attempt_at.is.null,next_attempt_at.lte."+new Date().toISOString()).order("id").limit(20);if(re)throw new Error(re.message);
  for(const r of rs??[]){try{const q=await send(token,Number(r.telegram_id),{body:b.body,mediaUrl:b.media_url,mediaType:b.media_type,buttons:b.buttons,broadcastId:id,recipientId:r.id,disableNotification:b.disable_notification,protectContent:b.protect_content});if(q.response.status===429){const sec=Math.max(1,Number(q.result?.parameters?.retry_after||5));await db.from("telegram_broadcast_recipients").update({attempts:r.attempts+1,next_attempt_at:new Date(Date.now()+sec*1000).toISOString(),error_message:"Telegram rate limit"}).eq("id",r.id);break;}if(!q.response.ok||!q.result?.ok){const msg=String(q.result?.description||"Telegram rejected the message");const blocked=/blocked|chat not found|deactivated|bot was blocked/i.test(msg);await db.from("telegram_broadcast_recipients").update({status:blocked?"blocked":"failed",attempts:r.attempts+1,error_message:msg}).eq("id",r.id);}else await db.from("telegram_broadcast_recipients").update({status:"sent",attempts:r.attempts+1,sent_at:new Date().toISOString(),error_message:null}).eq("id",r.id);}catch(e){await db.from("telegram_broadcast_recipients").update({status:"failed",attempts:r.attempts+1,error_message:e instanceof Error?e.message:"Network error"}).eq("id",r.id);}}
  const counts=await Promise.all(["pending","sent","failed","blocked"].map(s=>db.from("telegram_broadcast_recipients").select("id",{count:"exact",head:true}).eq("broadcast_id",id).eq("status",s)));
  const pending=counts[0].count??0;const done=pending===0;const {count:clicks}=await db.from("telegram_broadcast_clicks").select("id",{count:"exact",head:true}).eq("broadcast_id",id);
  const {data:u,error:ue}=await db.from("telegram_broadcasts").update({status:done?"completed":"sending",sent_count:counts[1].count??0,failed_count:counts[2].count??0,blocked_count:counts[3].count??0,click_count:clicks??0,completed_at:done?new Date().toISOString():null}).eq("id",id).select("*").single();if(ue)throw new Error(ue.message);return u;
}
export const processBroadcast=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:{id:string})=>d).handler(async({data,context})=>{const {db}=await ctx(context.userId);const token=String(process.env.TELEGRAM_BOT_TOKEN||"");if(!token)throw new Error("TELEGRAM_BOT_TOKEN is not configured.");return processOne(db,token,data.id);});
export const retryBroadcast=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:{id:string})=>d).handler(async({data,context})=>{const {db}=await ctx(context.userId);await db.from("telegram_broadcast_recipients").update({status:"pending",attempts:0,error_message:null,next_attempt_at:null}).eq("broadcast_id",data.id).eq("status","failed");return processOne(db,String(process.env.TELEGRAM_BOT_TOKEN||""),data.id);});
export async function processDue(limit=10){const {supabaseAdmin}=await import("@/integrations/supabase/client.server");const token=String(process.env.TELEGRAM_BOT_TOKEN||"");if(!token)throw new Error("TELEGRAM_BOT_TOKEN is not configured.");const {data,error}=await supabaseAdmin.from("telegram_broadcasts").select("id").eq("status","queued").or("scheduled_at.is.null,scheduled_at.lte."+new Date().toISOString()).order("created_at").limit(limit);if(error)throw new Error(error.message);for(const b of data??[])await processOne(supabaseAdmin,token,b.id);return{processed:data?.length??0};}
export const analytics=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).inputValidator((d:{id:string})=>d).handler(async({data,context})=>{const {db}=await ctx(context.userId);const {count}=await db.from("telegram_broadcast_clicks").select("id",{count:"exact",head:true}).eq("broadcast_id",data.id);const {data:rows}=await db.from("telegram_broadcast_clicks").select("button_index").eq("broadcast_id",data.id);const map=new Map<number,number>();for(const r of rows??[])map.set(Number(r.button_index),(map.get(Number(r.button_index))||0)+1);return{clicks:count??0,byButton:[...map].map(([buttonIndex,n])=>({buttonIndex,count:n}))};});
