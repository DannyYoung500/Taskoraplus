import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnerTelegramId } from "@/lib/owner";

async function db(){const {supabaseAdmin}=await import("@/integrations/supabase/client.server");return supabaseAdmin;}
async function owner(userId:string){const s=await db();const {data:role}=await s.rpc("has_role",{_user_id:userId,_role:"admin"});if(role)return;const {data:p}=await s.from("profiles").select("telegram_id").eq("id",userId).maybeSingle();if(isOwnerTelegramId((p as any)?.telegram_id??null))return;throw new Error("Owner/admin authorization required.");}
function localDate(tz:string){try{const p=new Intl.DateTimeFormat("en-CA",{timeZone:tz,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const g=(x:string)=>p.find(v=>v.type===x)?.value??"";return g("year")+"-"+g("month")+"-"+g("day");}catch{return new Date().toISOString().slice(0,10);}}

export const listDailyMissions=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const s=await db();const {data:p}=await s.from("profiles").select("timezone").eq("id",context.userId).maybeSingle();const date=localDate(String((p as any)?.timezone||"UTC"));const now=new Date().toISOString();
 const {data:missions,error}=await (s as any).from("daily_missions").select("id,title,description,mission_type,task_id,provider_key,reward_usdt,reward_points,daily_limit,starts_at,ends_at,is_active,task:tasks(id,title,description,platform,reward,link)").eq("is_active",true).or("starts_at.is.null,starts_at.lte."+now).or("ends_at.is.null,ends_at.gte."+now).order("created_at",{ascending:false}).limit(30);
 if(error)throw new Error(error.message);
 const ids=(missions??[]).map((m:any)=>m.id);const {data:claims}=ids.length?await (s as any).from("daily_mission_claims").select("mission_id,status").eq("user_id",context.userId).eq("mission_date",date).in("mission_id",ids):{data:[]};
 const claimMap=new Map((claims??[]).map((c:any)=>[c.mission_id,c]));const taskIds=(missions??[]).map((m:any)=>m.task_id).filter(Boolean);const {data:subs}=taskIds.length?await s.from("submissions").select("task_id,status").eq("user_id",context.userId).in("task_id",taskIds):{data:[]};const doneTasks=new Set((subs??[]).filter((x:any)=>x.status==="verified").map((x:any)=>x.task_id));
 const adKeys=[...new Set((missions??[]).filter((m:any)=>m.mission_type==="rewarded_ad"&&m.provider_key).map((m:any)=>String(m.provider_key)))];
 const providersByKey=new Map<string,any>();
 if(adKeys.length){const {data:prs}=await (s as any).from("monetization_providers").select("provider_key,provider_name,enabled,placement_id,settings").in("provider_key",adKeys);for(const p of prs??[])providersByKey.set(String(p.provider_key),p);}
 const completedCounts=new Map<string,number>();
 for(const c of claims??[]) if(c.status==="completed") completedCounts.set(c.mission_id,(completedCounts.get(c.mission_id)??0)+1);
 return (missions??[]).map((m:any)=>{
   const c=claimMap.get(m.id);const provider=providersByKey.get(String(m.provider_key));
   const adapterReady=String(m.provider_key)==="adsgram";
   const adReady=m.mission_type==="rewarded_ad"&&Boolean(provider?.enabled&&provider?.placement_id&&adapterReady);
   const settings=(provider?.settings??{}) as Record<string,unknown>;
   return {...m,completed:m.mission_type==="task"?doneTasks.has(m.task_id):c?.status==="completed",completedCount:completedCounts.get(m.id)??0,adReady:Boolean(adReady),adPlacementId:adReady?String(provider.placement_id):null,providerName:provider?.provider_name??m.provider_key,providerSettings:settings,adapterReady};
 });
});

export const claimRewardedAd=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:{missionId:string})=>d).handler(async({data,context})=>{
 const s=await db();const {data:p}=await s.from("profiles").select("timezone,status").eq("id",context.userId).maybeSingle();if(p&&String((p as any).status??"active")!=="active")throw new Error("Account is not active.");
 const date=localDate(String((p as any)?.timezone||"UTC"));const {data:m}=await (s as any).from("daily_missions").select("*").eq("id",data.missionId).eq("mission_type","rewarded_ad").eq("is_active",true).maybeSingle();if(!m)throw new Error("This ad mission is unavailable.");
 const now=new Date();if(m.starts_at&&new Date(m.starts_at)>now)throw new Error("This mission has not started yet.");if(m.ends_at&&new Date(m.ends_at)<now)throw new Error("This mission has ended.");
 const {data:provider}=await (s as any).from("monetization_providers").select("enabled,placement_id").eq("provider_key",m.provider_key).maybeSingle();if(String(m.provider_key)!=="adsgram")throw new Error("This ad network is not connected to TaskoraPlus yet.");if(!provider?.enabled||!provider?.placement_id)throw new Error("Rewarded ads are not configured yet.");
 const {count}=await (s as any).from("daily_mission_claims").select("id",{count:"exact",head:true}).eq("mission_id",m.id).eq("user_id",context.userId).eq("mission_date",date).eq("status","completed");if((count??0)>=Number(m.daily_limit))throw new Error("Today's ad mission limit is reached.");
 const {data:existing}=await (s as any).from("daily_mission_claims").select("id,status").eq("mission_id",m.id).eq("user_id",context.userId).eq("mission_date",date).maybeSingle();if(existing?.status==="completed")throw new Error("You already completed this ad mission today.");
 if(existing?.id)return {claimId:String(existing.id),placementId:String(provider.placement_id)};
 const {data:c,error}=await (s as any).from("daily_mission_claims").insert({mission_id:m.id,user_id:context.userId,mission_date:date,status:"pending"}).select("id").single();if(error||!c)throw new Error(error?.message??"Could not start ad reward.");
 return {claimId:String(c.id),placementId:String(provider.placement_id)};
});

export const finishRewardedAd=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:{claimId:string})=>d).handler(async({data,context})=>{
 const s=await db();const {data:c}=await (s as any).from("daily_mission_claims").select("id,mission_id,user_id,status,mission_date").eq("id",data.claimId).eq("user_id",context.userId).maybeSingle();if(!c)throw new Error("Ad reward session not found.");if(c.status==="completed")return {ok:true,already:true};
 const {data:m}=await (s as any).from("daily_missions").select("id,title,reward_usdt,reward_points,daily_limit").eq("id",c.mission_id).maybeSingle();if(!m)throw new Error("Mission not found.");
 if(c.status!=="pending")return {ok:true,already:c.status==="completed",pendingProviderConfirmation:false};
 // The client-side AdsGram promise is only a UX signal. The reward endpoint is the server authority.
 // Keep the claim pending until AdsGram calls /api/ads/adsgram/reward?userid=[userId].
 return {ok:true,already:false,pendingProviderConfirmation:true,rewardUsdt:Number(m.reward_usdt||0),rewardPoints:Number(m.reward_points||0)};
});

export const ownerListDailyMissions=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{await owner(context.userId);const s=await db();const {data,error}=await (s as any).from("daily_missions").select("*,task:tasks(id,title,platform,reward,slots_left,status)").order("created_at",{ascending:false}).limit(100);if(error)throw new Error(error.message);return data??[];});

export const ownerCreateDailyMission=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:{missionType:"task"|"rewarded_ad";title:string;description?:string;rewardUsdt:number;rewardPoints:number;dailyLimit:number;platform?:string;taskType?:string;targetUrl?:string;instructions?:string;slots?:number;proof?: "auto"|"screenshot"|"username";providerKey?:string})=>d).handler(async({data,context})=>{
 await owner(context.userId);const s=await db();if(!data.title.trim())throw new Error("Mission title is required.");if(data.rewardUsdt<0||data.rewardPoints<0)throw new Error("Reward cannot be negative.");
 if(data.missionType==="rewarded_ad"){const key=(data.providerKey||"adsgram").trim();const {data:pr}=await (s as any).from("monetization_providers").select("enabled,placement_id").eq("provider_key",key).maybeSingle();if(!pr?.enabled||!pr?.placement_id)throw new Error(key+" is not configured. Configure it in Owner → Monetization first.");const {data:m,error}=await (s as any).from("daily_missions").insert({title:data.title.trim(),description:data.description?.trim()||null,mission_type:"rewarded_ad",provider_key:key,reward_usdt:data.rewardUsdt,reward_points:data.rewardPoints,daily_limit:Math.max(1,Math.floor(data.dailyLimit||1)),is_active:true,created_by:context.userId}).select("*").single();if(error)throw new Error(error.message);return m;}
 const platform=data.platform||"telegram";const allowed=["telegram","youtube","whatsapp","x","instagram","tiktok","discord","facebook"];if(!allowed.includes(platform))throw new Error("Choose a valid task platform.");const slots=Math.max(1,Math.floor(data.slots||1));
 const {data:task,error:te}=await s.from("tasks").insert({platform:platform as never,task_type:data.taskType||"daily_mission",target:null,link:data.targetUrl?.trim()||null,title:data.title.trim(),description:data.description?.trim()||null,instructions:data.instructions?.trim()||null,advertiser:"TASKORA",reward:data.rewardUsdt,slots_left:slots,slots_total:slots,budget:data.rewardUsdt*slots,eligibility:null,proof:(data.proof||"screenshot") as never,completion_limit:1,requires_review:true,status:"active",is_active:true,steps:[data.instructions?.trim()||"Complete this daily mission","Return and submit proof"],created_by:context.userId}).select("id").single();if(te||!task)throw new Error(te?.message??"Could not create mission task.");
 const {data:m,error}=await (s as any).from("daily_missions").insert({title:data.title.trim(),description:data.description?.trim()||null,mission_type:"task",task_id:task.id,reward_usdt:data.rewardUsdt,reward_points:data.rewardPoints,daily_limit:1,is_active:true,created_by:context.userId}).select("*").single();if(error)throw new Error(error.message);return m;
});

export const ownerSetDailyMissionStatus=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:{missionId:string;active:boolean})=>d).handler(async({data,context})=>{await owner(context.userId);const s=await db();const {error}=await (s as any).from("daily_missions").update({is_active:Boolean(data.active),updated_at:new Date().toISOString()}).eq("id",data.missionId);if(error)throw new Error(error.message);return {ok:true};});
