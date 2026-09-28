import { createFileRoute } from "@tanstack/react-router";
export const Route=createFileRoute("/api/ads/adsgram/reward")({server:{handlers:{GET:async({request})=>{
 const url=new URL(request.url);const telegramId=url.searchParams.get("userid")||url.searchParams.get("userId");if(!telegramId)return Response.json({ok:false,error:"userid required"},{status:400});
 const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
 const {data:profile}=await supabaseAdmin.from("profiles").select("id").eq("telegram_id",telegramId).maybeSingle();if(!profile)return Response.json({ok:false,error:"user not found"},{status:404});
 const {data:claim}=await (supabaseAdmin as any).from("daily_mission_claims").select("id,mission_id,status,created_at").eq("user_id",profile.id).eq("status","pending").order("created_at",{ascending:false}).limit(1).maybeSingle();if(!claim)return Response.json({ok:true,credited:false,reason:"no_pending_claim"});
 const {data:mission}=await (supabaseAdmin as any).from("daily_missions").select("id,title,reward_usdt,reward_points,provider_key,is_active").eq("id",claim.mission_id).maybeSingle();if(!mission||mission.provider_key!=="adsgram"||!mission.is_active)return Response.json({ok:true,credited:false,reason:"claim_not_adsgram"});
 const {data:updated,error}=await (supabaseAdmin as any).from("daily_mission_claims").update({status:"completed",provider_event_id:"adsgram:reward:"+telegramId+":"+claim.id,reward_usdt:Number(mission.reward_usdt||0),reward_points:Number(mission.reward_points||0),completed_at:new Date().toISOString()}).eq("id",claim.id).eq("status","pending").select("id").maybeSingle();
 if(error||!updated)return Response.json({ok:true,credited:false,reason:"already_processed"});
 if(Number(mission.reward_usdt||0)>0){const {error:e}=await supabaseAdmin.from("transactions").insert({user_id:profile.id,label:"Daily mission — "+String(mission.title),amount:Number(mission.reward_usdt),kind:"reward"});if(e)return Response.json({ok:false,error:e.message},{status:500});}
 if(Number(mission.reward_points||0)>0){const {data:p}=await supabaseAdmin.from("profiles").select("task_points").eq("id",profile.id).maybeSingle();await supabaseAdmin.from("profiles").update({task_points:Number((p as any)?.task_points||0)+Number(mission.reward_points)} as never).eq("id",profile.id);}
 await supabaseAdmin.from("notifications").insert({user_id:profile.id,title:"Daily mission completed",body:"Your ad reward was confirmed by the ad network.",category:"daily_mission"});
 return Response.json({ok:true,credited:true});
}}}});