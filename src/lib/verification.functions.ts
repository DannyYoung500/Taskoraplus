import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnerTelegramId } from "@/lib/owner";

async function db(){const {supabaseAdmin}=await import("@/integrations/supabase/client.server");return supabaseAdmin as any;}
async function owner(userId:string){const s=await db();const {data:role}=await s.rpc("has_role",{_user_id:userId,_role:"admin"});if(role)return;const {data:p}=await s.from("profiles").select("telegram_id").eq("id",userId).maybeSingle();if(isOwnerTelegramId(p?.telegram_id??null))return;throw new Error("Owner/admin authorization required.");}

export const getMyVerificationStatus=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 const s=await db();const [pr,cs,ca]=await Promise.all([
  s.from("profiles").select("verification_status,verification_level,verification_verified_at,risk_score").eq("id",context.userId).maybeSingle(),
  s.from("verification_cases").select("id,subject_type,verification_type,status,risk_score,reason,evidence,verified_at,created_at,updated_at").eq("subject_id",context.userId).order("updated_at",{ascending:false}).limit(50),
  s.from("connected_accounts").select("id",{count:"exact",head:true}).eq("user_id",context.userId).eq("status","verified")
 ]);
 if(cs.error)throw new Error(cs.error.message);return {profile:pr.data,cases:cs.data??[],connectedVerified:ca.count??0};
});

export const getOwnerVerificationDashboard=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
 await owner(context.userId);const s=await db();
 const [p,r,v,j,u,c,w,d]=await Promise.all([
  s.from("verification_cases").select("id",{count:"exact",head:true}).eq("status","pending"),
  s.from("verification_cases").select("id",{count:"exact",head:true}).eq("status","review"),
  s.from("verification_cases").select("id",{count:"exact",head:true}).eq("status","verified"),
  s.from("verification_cases").select("id",{count:"exact",head:true}).eq("status","rejected"),
  s.from("profiles").select("id",{count:"exact",head:true}),
  s.from("connected_accounts").select("id",{count:"exact",head:true}).eq("status","verified"),
  s.from("withdrawals").select("id",{count:"exact",head:true}).in("status",["pending","processing"]),
  s.from("deposits").select("id",{count:"exact",head:true}).in("status",["pending","processing"])
 ]);
 const {data:cases,error}=await s.from("verification_cases").select("id,subject_type,subject_id,verification_type,status,risk_score,reason,evidence,reviewed_by,reviewed_at,verified_at,created_at,updated_at").order("updated_at",{ascending:false}).limit(100);
 if(error)throw new Error(error.message);
 return {counts:{pending:p.count??0,review:r.count??0,verified:v.count??0,rejected:j.count??0,users:u.count??0,connected:c.count??0,withdrawals:w.count??0,deposits:d.count??0},cases:cases??[]};
});

export const reviewVerificationCase=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:{caseId:string;decision:"verified"|"rejected"|"review";reason?:string})=>d).handler(async({data,context})=>{
 await owner(context.userId);const s=await db();const {data:row,error}=await s.from("verification_cases").select("*").eq("id",data.caseId).maybeSingle();if(error||!row)throw new Error("Verification case not found.");
 const now=new Date().toISOString();const reason=data.reason?.trim()||null;
 const {error:ue}=await s.from("verification_cases").update({status:data.decision,reason,reviewed_by:context.userId,reviewed_at:now,verified_at:data.decision==="verified"?now:null,updated_at:now}).eq("id",data.caseId);if(ue)throw new Error(ue.message);
 await s.from("verification_events").insert({case_id:data.caseId,action:data.decision,actor_id:context.userId,evidence:{risk_score:row.risk_score,subject_type:row.subject_type,subject_id:row.subject_id},note:reason});
 if(row.subject_type==="user"){await s.from("profiles").update({verification_status:data.decision==="verified"?"verified":data.decision==="rejected"?"restricted":"pending",verification_level:data.decision==="verified"?"verified":"basic",verification_verified_at:data.decision==="verified"?now:null}).eq("id",row.subject_id);}
 if(row.subject_type==="connected_account"&&data.decision==="verified")await s.from("connected_accounts").update({status:"verified",verified_at:now,updated_at:now}).eq("id",row.subject_id);
 return {ok:true};
});