import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnerTelegramId } from "@/lib/owner";

async function db(){const {supabaseAdmin}=await import("@/integrations/supabase/client.server");return supabaseAdmin as any;}
async function owner(userId:string){const s=await db();const {data:role}=await s.rpc("has_role",{_user_id:userId,_role:"admin"});if(role)return;const {data:p}=await s.from("profiles").select("telegram_id").eq("id",userId).maybeSingle();if(isOwnerTelegramId(p?.telegram_id??null))return;throw new Error("Owner/admin authorization required.");}

async function resolveSubjectUser(s:any,row:any){
 if(row.subject_type==="user"||row.subject_type==="advertiser") return row.subject_id;
 if(row.subject_type==="connected_account"){const {data}=await s.from("connected_accounts").select("user_id").eq("id",row.subject_id).maybeSingle();return data?.user_id??null;}
 if(row.subject_type==="task"){const {data}=await s.from("submissions").select("user_id").eq("id",row.subject_id).maybeSingle();return data?.user_id??null;}
 if(row.subject_type==="reward"){const {data}=await s.from("daily_mission_claims").select("user_id").eq("id",row.subject_id).maybeSingle();return data?.user_id??null;}
 if(row.subject_type==="withdrawal"||row.subject_type==="deposit"){const {data}=await s.from(row.subject_type==="withdrawal"?"withdrawals":"deposits").select("user_id").eq("id",row.subject_id).maybeSingle();return data?.user_id??null;}
 return null;
}

async function buildUserSnapshot(s:any,userId:string){
 const [pr,ca,subs,wds,deps,claims,txs,flags] = await Promise.all([
  s.from("profiles").select("id,display_name,username,photo_url,telegram_id,country,country_code,level,level_num,streak,created_at,last_active_at,last_seen_at,status,account_status,verification_status,verification_level,verification_verified_at,risk_score,risk_band,freeze_withdrawals,freeze_spending,restrict_tasks,wallet_frozen,wallet_frozen_reason,device_fp,last_ip_hint,timezone,admin_notes").eq("id",userId).maybeSingle(),
  s.from("connected_accounts").select("id,platform,handle,profile_url,status,external_id,verified_at,created_at,meta").eq("user_id",userId).order("created_at",{ascending:false}).limit(30),
  s.from("submissions").select("id,task_id,status,proof_text,proof_url,fraud_flag,rejection_reason,reviewed_by,reviewed_at,proof_hash,created_at,updated_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(30),
  s.from("withdrawals").select("id,method,address,amount,status,approval_stage,requires_dual,tx_hash,reference,risk_status,rejection_reason,failure_reason,created_at,updated_at,processed_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(30),
  s.from("deposits").select("id,amount,method,reference,status,verified_at,verified_by,notes,created_at,updated_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(30),
  s.from("daily_mission_claims").select("id,mission_id,status,reward_usdt,reward_points,provider_event_id,mission_date,created_at,completed_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(50),
  s.from("transactions").select("id,label,amount,kind,created_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(50),
  s.from("fraud_flags").select("id,status,reason,metadata,created_at,resolved_at").eq("user_id",userId).order("created_at",{ascending:false}).limit(50),
 ]);
 return {profile:pr.data,connectedAccounts:ca.data??[],submissions:subs.data??[],withdrawals:wds.data??[],deposits:deps.data??[],claims:claims.data??[],transactions:txs.data??[],fraudFlags:flags.data??[],errors:[pr,ca,subs,wds,deps,claims,txs,flags].filter((x:any)=>x.error).map((x:any)=>x.error.message)};
}

function scanSignals(snapshot:any){
 const p=snapshot.profile||{};const signals:any[]=[];let score=Math.max(0,Math.min(100,Number(p.risk_score||0)));
 const add=(code:string,severity:number,message:string,detail:any={})=>{score=Math.min(100,score+severity);signals.push({code,severity,message,detail});};
 const verifiedAccounts=snapshot.connectedAccounts.filter((x:any)=>x.status==="verified").length;
 const frauds=snapshot.submissions.filter((x:any)=>x.fraud_flag===true).length;
 const rejectedSubs=snapshot.submissions.filter((x:any)=>String(x.status).toLowerCase()==="rejected").length;
 const pendingWds=snapshot.withdrawals.filter((x:any)=>["pending","processing"].includes(String(x.status).toLowerCase())).length;
 const riskyWds=snapshot.withdrawals.filter((x:any)=>!["clear","low",""].includes(String(x.risk_status||"").toLowerCase())).length;
 const pendingDeps=snapshot.deposits.filter((x:any)=>["pending","processing"].includes(String(x.status).toLowerCase())).length;
 const completed24=snapshot.claims.filter((x:any)=>x.completed_at&&Date.now()-new Date(x.completed_at).getTime()<86400000).length;
 const sameDeviceCount=snapshot.deviceFpCount??0;const sameIpCount=snapshot.lastIpCount??0;
 const openFraudFlags=(snapshot.fraudFlags??[]).filter((x:any)=>String(x.status||"open")==="open").length;
 const proofCounts=new Map<string,number>();
 for(const row of snapshot.submissions){const h=String(row.proof_hash||"").trim();if(h)proofCounts.set(h,(proofCounts.get(h)||0)+1);}
 const duplicateProofs=[...proofCounts.values()].filter((n)=>n>1).reduce((a,n)=>a+n,0);
 if(frauds)add("fraud_flags",35,"Submission fraud flags require owner review.",{count:frauds});
 if(openFraudFlags)add("open_fraud_cases",25,"There are unresolved fraud flags on this account.",{count:openFraudFlags});
 if(duplicateProofs)add("duplicate_proof_hashes",25,"The same proof hash appears on multiple submissions.",{submissions:duplicateProofs});
 if(rejectedSubs>=3)add("repeated_rejections",15,"Multiple task submissions were rejected.",{count:rejectedSubs});
 if(riskyWds)add("withdrawal_risk",20,"One or more withdrawals have a non-clear risk status.",{count:riskyWds});
 if(p.wallet_frozen||p.freeze_withdrawals||p.freeze_spending||p.restrict_tasks)add("account_controls",20,"Existing account controls require attention.");
 if(sameDeviceCount>1)add("shared_device",20,"The device fingerprint is shared by multiple accounts.",{accounts:sameDeviceCount});
 if(sameIpCount>3)add("shared_ip",15,"The last IP hint is shared by several accounts.",{accounts:sameIpCount});
 if(verifiedAccounts===0)signals.push({code:"no_connected_account",severity:0,message:"No verified connected account on file."});
 if(pendingWds)signals.push({code:"pending_withdrawals",severity:0,message:"There are pending withdrawals.",detail:{count:pendingWds}});
 if(pendingDeps)signals.push({code:"pending_deposits",severity:0,message:"There are pending deposits.",detail:{count:pendingDeps}});
 if(completed24>=20)add("high_reward_velocity",15,"Unusually high number of completed daily-mission rewards in the last 24 hours.",{count:completed24});
 if(!signals.length)signals.push({code:"no_material_flags",severity:0,message:"No material automated risk signal was found in the available TaskoraPlus records."});
 return {score,outcome:score>=70?"high_risk":score>=30?"review":"clear",signals};
}

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

export const getOwnerVerificationCaseDetail=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).inputValidator((d:{caseId:string})=>d).handler(async({data,context})=>{
 await owner(context.userId);const s=await db();const {data:row,error}=await s.from("verification_cases").select("*").eq("id",data.caseId).maybeSingle();
 if(error||!row)throw new Error("Verification case not found.");const userId=await resolveSubjectUser(s,row);if(!userId)return {case:row,user:null,scanHistory:[]};
 const snapshot:any=await buildUserSnapshot(s,userId);
 const [{data:scanHistory},{data:deviceMatches},{data:ipMatches}]=await Promise.all([
  s.from("verification_scans").select("id,outcome,risk_score,signals,scanned_by,created_at").eq("case_id",row.id).order("created_at",{ascending:false}).limit(10),
  snapshot.profile?.device_fp?s.from("profiles").select("id").eq("device_fp",snapshot.profile.device_fp):Promise.resolve({data:[]}),
  snapshot.profile?.last_ip_hint?s.from("profiles").select("id").eq("last_ip_hint",snapshot.profile.last_ip_hint):Promise.resolve({data:[]})
 ]);
 snapshot.deviceFpCount=(deviceMatches??[]).length;snapshot.lastIpCount=(ipMatches??[]).length;
 return {case:row,userId,snapshot,scanHistory:scanHistory??[]};
});

export const scanVerificationCase=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:{caseId:string})=>d).handler(async({data,context})=>{
 await owner(context.userId);const s=await db();const {data:row,error}=await s.from("verification_cases").select("*").eq("id",data.caseId).maybeSingle();
 if(error||!row)throw new Error("Verification case not found.");const userId=await resolveSubjectUser(s,row);if(!userId)throw new Error("This verification case has no user account to scan.");
 const snapshot=await buildUserSnapshot(s,userId);
 const [{data:deviceMatches},{data:ipMatches}]=await Promise.all([
  snapshot.profile?.device_fp?s.from("profiles").select("id").eq("device_fp",snapshot.profile.device_fp):Promise.resolve({data:[]}),
  snapshot.profile?.last_ip_hint?s.from("profiles").select("id").eq("last_ip_hint",snapshot.profile.last_ip_hint):Promise.resolve({data:[]})
 ]);
 snapshot.deviceFpCount=(deviceMatches??[]).length;snapshot.lastIpCount=(ipMatches??[]).length;
 const result=scanSignals(snapshot);
 if (result.outcome === "high_risk") {
   const reason = "Automated verification scan: high-risk signals";
   const { data:existingFlag } = await s.from("fraud_flags").select("id").eq("user_id",userId).eq("status","open").eq("reason",reason).maybeSingle();
   if (!existingFlag) {
     await s.from("fraud_flags").insert({
       user_id:userId,status:"open",reason,
       metadata:{case_id:row.id,risk_score:result.score,signals:result.signals},
     });
   }
 }
 const {data:scan,error:se}=await s.from("verification_scans").insert({case_id:row.id,subject_type:row.subject_type,subject_id:userId,scan_status:"completed",outcome:result.outcome,risk_score:result.score,signals:result.signals,snapshot:{profile:snapshot.profile,counts:{connected:snapshot.connectedAccounts.length,verifiedConnected:snapshot.connectedAccounts.filter((x:any)=>x.status==="verified").length,submissions:snapshot.submissions.length,withdrawals:snapshot.withdrawals.length,deposits:snapshot.deposits.length,rewards:snapshot.claims.length,transactions:snapshot.transactions.length,openFraudFlags:(snapshot.fraudFlags??[]).filter((x:any)=>String(x.status||"open")==="open").length}},scanned_by:context.userId}).select("id,outcome,risk_score,signals,created_at").single();
 if(se)throw new Error(se.message);
 await s.from("verification_events").insert({case_id:row.id,action:"automated_scan",actor_id:context.userId,evidence:{scan_id:scan.id,outcome:result.outcome,risk_score:result.score,signals:result.signals},note:"Owner initiated automated verification scan."});
 await s.from("verification_cases").update({risk_score:Math.max(Number(row.risk_score||0),result.score),reason:result.outcome==="high_risk"?"Automated scan found high-risk signals.":result.outcome==="review"?"Automated scan found signals requiring owner review.":row.reason,updated_at:new Date().toISOString()}).eq("id",row.id);
 return {scan,userId,profile:snapshot.profile,result};
});

export const reviewVerificationCase=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:{caseId:string;decision:"verified"|"rejected"|"review";reason?:string})=>d).handler(async({data,context})=>{
 await owner(context.userId);const s=await db();const {data:row,error}=await s.from("verification_cases").select("*").eq("id",data.caseId).maybeSingle();if(error||!row)throw new Error("Verification case not found.");
 const now=new Date().toISOString();const reason=data.reason?.trim()||null;const {error:ue}=await s.from("verification_cases").update({status:data.decision,reason,reviewed_by:context.userId,reviewed_at:now,verified_at:data.decision==="verified"?now:null,updated_at:now}).eq("id",data.caseId);if(ue)throw new Error(ue.message);
 await s.from("verification_events").insert({case_id:data.caseId,action:data.decision,actor_id:context.userId,evidence:{risk_score:row.risk_score,subject_type:row.subject_type,subject_id:row.subject_id},note:reason});
 if(row.subject_type==="user"){await s.from("profiles").update({verification_status:data.decision==="verified"?"verified":data.decision==="rejected"?"restricted":"pending",verification_level:data.decision==="verified"?"verified":"basic",verification_verified_at:data.decision==="verified"?now:null}).eq("id",row.subject_id);}
 if(row.subject_type==="connected_account"&&data.decision==="verified")await s.from("connected_accounts").update({status:"verified",verified_at:now,updated_at:now}).eq("id",row.subject_id);
 return {ok:true};
});