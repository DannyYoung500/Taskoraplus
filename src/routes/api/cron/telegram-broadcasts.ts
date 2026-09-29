import { createFileRoute } from "@tanstack/react-router";
import { authenticateCronRequest } from "@/integrations/supabase/cron-auth";
import { processDue } from "@/lib/telegram-broadcast-v2.functions";

async function run(request:Request){
 const denied=await authenticateCronRequest(request); if(denied)return denied;
 try{return Response.json({ok:true,...await processDue(10)});}
 catch(e){return Response.json({ok:false,error:e instanceof Error?e.message:"Broadcast queue failed"},{status:500});}
}
export const Route=createFileRoute("/api/cron/telegram-broadcasts")({server:{handlers:{GET:({request})=>run(request),POST:({request})=>run(request)}}});
