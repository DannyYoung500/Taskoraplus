import { createFileRoute } from "@tanstack/react-router";
export const Route=createFileRoute("/api/ads/adsgram/reward")({server:{handlers:{GET:async({request})=>{
 const url=new URL(request.url);const telegramId=url.searchParams.get("userid")||url.searchParams.get("userId");if(!telegramId)return Response.json({ok:false,error:"userid required"},{status:400});
 const {supabaseAdmin}=await import("@/integrations/supabase/client.server");const {data:profile}=await supabaseAdmin.from("profiles").select("id").eq("telegram_id",telegramId).maybeSingle();if(!profile)return Response.json({ok:false,error:"user not found"},{status:404});
 const {data:mission}=await (supabaseAdmin as any).from("daily_missions").select("id,title,reward_usdt,reward_points").eq("provider_key","adsgram").eq("is_active",true).order("created_at",{ascending:false}).limit(1).maybeSingle();if(!mission)return Response.json({ok:false,error:"no active ad mission"},{status:404});
 const {data:claim}=await (supabaseAdmin as any).from("daily_mission_claims").select("id,status").eq("mission_id",mission.id).eq("user_id",profile.id).eq("status","pending").order("created_at",{ascending:false}).limit(1).maybeSingle();if(!claim)return Response.json({ok:true,credited:false});
 const {data:updated,error}=await (supabaseAdmin as any).from("daily_mission_claims").update({status:"completed",reward_usdt:Number(mission.reward_usdt||0),reward_points:Number(mission.reward_points||0),completed_at:new Date().toISOString()}).eq("id",claim.id).eq("status","pending").select("id").maybeSingle();if(error||!updated)return Response.json({ok:true,credited:false});
 if(Number(mission.reward_usdt||0)>0)await supabaseAdmin.from("transactions").insert({user_id:profile.id,label:"Daily mission — "+String(mission.title),amount:Number(mission.reward_usdt),kind:"reward"});
 if(Number(mission.reward_points||0)>0){const {data:p}=await supabaseAdmin.from("profiles").select("task_points").eq("id",profile.id).maybeSingle();await supabaseAdmin.from("profiles").update({task_points:Number((p as any)?.task_points||0)+Number(mission.reward_points)} as never).eq("id",profile.id);}
 return Response.json({ok:true,credited:true});
}}}});
