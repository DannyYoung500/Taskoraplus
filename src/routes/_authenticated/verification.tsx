import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldAlert, Clock3, Link2 } from "lucide-react";
import { getMyVerificationStatus } from "@/lib/verification.functions";

export const Route=createFileRoute("/_authenticated/verification")({component:VerificationPage});

function VerificationPage(){
 const q=useQuery({queryKey:["my-verification"],queryFn:()=>getMyVerificationStatus()});
 if(q.isLoading)return <main className="min-h-screen bg-[#07152b] p-5 text-slate-200"><div className="mx-auto max-w-3xl animate-pulse rounded-3xl border border-white/10 bg-white/[.03] p-6">Loading verification…</div></main>;
 if(q.error)return <main className="min-h-screen bg-[#07152b] p-5 text-red-300">{String(q.error)}</main>;
 const p=q.data?.profile; const status=safeStatus(p?.verification_status); const level=String(p?.verification_level??"basic");
 const icon=status==="verified"?<ShieldCheck className="size-6 text-emerald-400"/>:status==="restricted"||status==="blocked"?<ShieldAlert className="size-6 text-amber-400"/>:<Clock3 className="size-6 text-blue-400"/>;
 return <main className="min-h-screen bg-[#07152b] px-4 py-6 text-slate-100"><div className="mx-auto max-w-3xl space-y-4">
  <section className="rounded-3xl border border-white/10 bg-[#0b1b32] p-5"><div className="flex items-center gap-3">{icon}<div><h1 className="text-xl font-semibold">Verification & Trust</h1><p className="text-sm text-slate-400">Your trust status is based on real TaskoraPlus activity and verification records.</p></div></div>
   <div className="mt-5 grid gap-3 sm:grid-cols-3"><Stat label="Status" value={status}/><Stat label="Trust level" value={level}/><Stat label="Risk score" value={String(p?.risk_score??0)}/></div>
   <div className="mt-4 rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-slate-300"><p className="font-medium text-slate-100">How it works</p><p className="mt-1">Connected accounts, task proofs, rewards, deposits and withdrawals are checked against server-side records. A review does not automatically mean your account is blocked.</p></div>
  </section>
  <section className="rounded-3xl border border-white/10 bg-[#0b1b32] p-5"><h2 className="font-semibold">Verification history</h2><div className="mt-3 space-y-2">{(q.data?.cases??[]).map((c:any)=><div key={c.id} className="rounded-2xl border border-white/10 p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">{label(c.subject_type)} · {label(c.verification_type)}</p><p className="text-xs text-slate-500">{new Date(c.updated_at).toLocaleString()}</p></div><Badge status={c.status}/></div>{c.reason&&<p className="mt-2 text-xs text-slate-400">{c.reason}</p>}</div>)}{!(q.data?.cases?.length)&&<p className="text-sm text-slate-500">No verification events yet.</p>}</div></section>
  <section className="rounded-3xl border border-white/10 bg-[#0b1b32] p-5"><div className="flex items-center gap-2"><Link2 className="size-4 text-blue-400"/><h2 className="font-semibold">Connected accounts</h2></div><p className="mt-2 text-sm text-slate-400">{q.data?.connectedVerified??0} verified connected account(s). Ownership verification is recorded separately from your profile status.</p></section>
 </div></main>;
}
function safeStatus(v:any){return v==="verified"?"verified":v==="restricted"?"restricted":v==="blocked"?"blocked":v==="pending"?"pending":"unverified"}
function label(v:any){return String(v??"").replaceAll("_"," ").replace(/\b\w/g,m=>m.toUpperCase())}
function Stat({label,value}:{label:string;value:string}){return <div className="rounded-2xl border border-white/10 bg-white/[.03] p-3"><p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-sm font-semibold capitalize">{value}</p></div>}
function Badge({status}:{status:string}){return <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] capitalize text-slate-300">{status}</span>}