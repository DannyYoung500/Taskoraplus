import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ShieldCheck, Search, RefreshCw, AlertTriangle } from "lucide-react";
import { OwnerShell } from "@/components/OwnerShell";
import { getOwnerVerificationDashboard, reviewVerificationCase } from "@/lib/verification.functions";

export const Route=createFileRoute("/_authenticated/owner/verification")({component:OwnerVerification});

function OwnerVerification(){
 const q=useQuery({queryKey:["owner-verification"],queryFn:()=>getOwnerVerificationDashboard()});
 const [search,setSearch]=useState(""); const [busy,setBusy]=useState<string|null>(null);
 const review=useMutation({mutationFn:(x:{caseId:string;decision:"verified"|"rejected"|"review";reason?:string})=>reviewVerificationCase({data:x}),onSettled:()=>q.refetch()});
 const cases=(q.data?.cases??[]).filter((c:any)=>!search||[c.subject_id,c.subject_type,c.verification_type,c.status,c.reason].join(" ").toLowerCase().includes(search.toLowerCase()));
 if(q.isLoading)return <OwnerShell><div className="p-5 text-slate-300">Loading Verification & Trust…</div></OwnerShell>;
 if(q.error)return <OwnerShell><div className="p-5 text-red-300">{String(q.error)}</div></OwnerShell>;
 const c=q.data?.counts;
 return <OwnerShell><main className="p-4 sm:p-6"><div className="mx-auto max-w-7xl space-y-5">
  <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="flex items-center gap-2"><ShieldCheck className="size-6 text-blue-400"/><h1 className="text-2xl font-semibold">Verification & Trust</h1></div><p className="mt-1 text-sm text-slate-400">One server-side review layer for users, tasks, rewards, accounts, money and ad providers.</p></div><button onClick={()=>q.refetch()} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm"><RefreshCw className="mr-2 inline size-4"/>Refresh</button></div>
  <div className="grid gap-3 grid-cols-2 md:grid-cols-4 xl:grid-cols-8">{Object.entries(c??{}).map(([k,v])=><div key={k} className="rounded-2xl border border-white/10 bg-white/[.03] p-3"><p className="text-[10px] uppercase tracking-wider text-slate-500">{k}</p><p className="mt-1 text-xl font-semibold">{String(v)}</p></div>)}</div>
  <div className="rounded-2xl border border-white/10 bg-white/[.03] p-3"><div className="relative"><Search className="absolute left-3 top-3 size-4 text-slate-500"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search case, user ID, type or reason…" className="w-full rounded-xl border border-white/10 bg-black/10 py-2.5 pl-9 pr-3 text-sm outline-none"/></div></div>
  <div className="space-y-3">{cases.map((x:any)=><article key={x.id} className="rounded-2xl border border-white/10 bg-white/[.03] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-medium">{pretty(x.subject_type)} · {pretty(x.verification_type)}</p><p className="mt-1 break-all text-xs text-slate-500">{x.subject_id} · risk {x.risk_score}</p></div><span className="rounded-full border border-white/10 px-2.5 py-1 text-xs capitalize">{x.status}</span></div>{x.reason&&<p className="mt-2 flex gap-2 text-sm text-amber-200"><AlertTriangle className="mt-0.5 size-4 shrink-0"/>{x.reason}</p>}<div className="mt-3 flex flex-wrap gap-2"><button disabled={busy===x.id} onClick={async()=>{setBusy(x.id);await review.mutateAsync({caseId:x.id,decision:"verified"}).finally(()=>setBusy(null))}} className="rounded-lg bg-emerald-500/15 px-3 py-2 text-xs text-emerald-300 disabled:opacity-50">Verify</button><button disabled={busy===x.id} onClick={async()=>{const reason=window.prompt("Reason for rejection/restriction?")||"Rejected after owner review.";setBusy(x.id);await review.mutateAsync({caseId:x.id,decision:"rejected",reason}).finally(()=>setBusy(null))}} className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300 disabled:opacity-50">Reject / Restrict</button><button disabled={busy===x.id} onClick={async()=>{setBusy(x.id);await review.mutateAsync({caseId:x.id,decision:"review",reason:"Needs further evidence."}).finally(()=>setBusy(null))}} className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300 disabled:opacity-50">Keep in Review</button></div></article>)}{!cases.length&&<div className="rounded-2xl border border-white/10 p-8 text-center text-sm text-slate-500">No verification cases match.</div>}</div>
 </div></main></OwnerShell>;
}
function pretty(v:any){return String(v??"").replaceAll("_"," ").replace(/\b\w/g,m=>m.toUpperCase())}