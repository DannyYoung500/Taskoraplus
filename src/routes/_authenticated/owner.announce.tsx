import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createTelegramBroadcast, listTelegramBroadcasts, processTelegramBroadcast } from "@/lib/telegram-broadcast.functions";

export const Route = createFileRoute("/_authenticated/owner/announce")({ component: OwnerAnnounce });

function OwnerAnnounce() {
  const [title,setTitle]=useState("");
  const [body,setBody]=useState("");
  const [mediaUrl,setMediaUrl]=useState("");
  const [buttonText,setButtonText]=useState("");
  const [buttonUrl,setButtonUrl]=useState("");
  const [audience,setAudience]=useState<"all_active"|"all_telegram">("all_active");
  const [busy,setBusy]=useState(false);
  const [msg,setMsg]=useState<string|null>(null);
  const [broadcasts,setBroadcasts]=useState<any[]>([]);

  async function refresh(){ try { setBroadcasts(await listTelegramBroadcasts({data:undefined as never})); } catch(e){ setMsg(e instanceof Error?e.message:"Failed to load broadcasts"); } }
  useEffect(()=>{ void refresh(); },[]);

  async function send(){
    setBusy(true); setMsg(null);
    try {
      const created=await createTelegramBroadcast({data:{title,body,mediaUrl,buttonText,buttonUrl,audience}});
      setTitle(""); setBody(""); setMediaUrl(""); setButtonText(""); setButtonUrl("");
      let current=await processTelegramBroadcast({data:{broadcastId:created.id}});
      setBroadcasts((items)=>[current,...items.filter((x)=>x.id!==current.id)]);
      const started=Date.now();
      while(current.status==="sending" && Date.now()-started<120000){
        await new Promise((r)=>setTimeout(r,1200));
        current=await processTelegramBroadcast({data:{broadcastId:current.id}});
        setBroadcasts((items)=>[current,...items.filter((x)=>x.id!==current.id)]);
      }
      if(current.status==="completed") setMsg("Broadcast completed.");
      else setMsg("Broadcast is still sending. You can leave this page; progress is saved.");
    } catch(e){ setMsg(e instanceof Error?e.message:"Broadcast failed"); }
    finally { setBusy(false); }
  }

  return <main className="mx-auto min-h-screen w-full max-w-3xl bg-[#05070c] px-4 pb-28 pt-5 text-white">
    <div className="mb-5"><h1 className="text-xl font-bold">Broadcast</h1><p className="mt-1 text-xs text-white/45">Send a real message through the TaskoraPlus Telegram bot.</p></div>
    <section className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
      <div className="rounded-2xl border border-white/10 bg-[#12141c] p-4">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Title</label>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Announcement title" className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm"/>
        <label className="mt-4 block text-[10px] font-semibold uppercase tracking-wider text-white/40">Telegram message</label>
        <textarea value={body} onChange={e=>setBody(e.target.value)} placeholder="Write the message sent to Telegram..." rows={9} className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm leading-5"/>
        <p className="mt-1 text-[10px] text-white/35">{body.length}/4096 · Telegram HTML formatting is supported.</p>
        <label className="mt-4 block text-[10px] font-semibold uppercase tracking-wider text-white/40">Image URL (optional)</label>
        <input value={mediaUrl} onChange={e=>setMediaUrl(e.target.value)} placeholder="https://..." className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm"/>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <div><label className="text-[10px] text-white/40">Button text</label><input value={buttonText} onChange={e=>setButtonText(e.target.value)} placeholder="Open TaskoraPlus" className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm"/></div>
          <div><label className="text-[10px] text-white/40">Button URL</label><input value={buttonUrl} onChange={e=>setButtonUrl(e.target.value)} placeholder="https://..." className="mt-1 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm"/></div>
        </div>
        <label className="mt-4 block text-[10px] font-semibold uppercase tracking-wider text-white/40">Audience</label>
        <select value={audience} onChange={e=>setAudience(e.target.value as typeof audience)} className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm"><option value="all_active">All active Telegram users</option><option value="all_telegram">All Telegram-linked users</option></select>
        <button type="button" disabled={busy||!title.trim()||!body.trim()} onClick={()=>void send()} className="mt-5 w-full rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 py-3.5 text-sm font-bold text-[#071019] disabled:opacity-40">{busy?"Sending…":"Send Telegram Broadcast"}</button>
        {msg?<p className="mt-3 text-center text-xs text-white/55">{msg}</p>:null}
      </div>
      <div className="rounded-2xl border border-white/10 bg-[#12141c] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Telegram preview</p>
        <div className="mt-3 rounded-2xl bg-[#18212b] p-3 text-sm"><p className="font-bold">{title||"Announcement title"}</p><p className="mt-2 whitespace-pre-wrap text-white/80">{body||"Your Telegram message will appear here."}</p>{buttonText&&buttonUrl?<button className="mt-3 w-full rounded-xl bg-sky-400/15 py-2 text-xs font-bold text-sky-200">{buttonText}</button>:null}</div>
        <div className="mt-5"><p className="text-[10px] font-semibold uppercase tracking-wider text-white/40">Recent broadcasts</p><div className="mt-2 space-y-2">{broadcasts.map((b)=><div key={b.id} className="rounded-xl border border-white/8 bg-black/20 p-3"><div className="flex items-center justify-between"><span className="text-xs font-bold">{b.title}</span><span className="text-[10px] text-white/40">{b.status}</span></div><div className="mt-2 grid grid-cols-4 gap-1 text-center text-[10px]"><span><b>{b.total_recipients}</b><br/>Total</span><span><b className="text-emerald-300">{b.sent_count}</b><br/>Sent</span><span><b className="text-rose-300">{b.failed_count}</b><br/>Failed</span><span><b className="text-amber-300">{b.blocked_count}</b><br/>Blocked</span></div></div>)}</div></div>
      </div>
    </section>
  </main>;
}
