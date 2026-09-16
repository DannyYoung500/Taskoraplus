import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, Save, Send, Eye, RotateCcw, Plus, Trash2, GripVertical } from "lucide-react";
import { TASKORA_LOGO } from "@/lib/brand";
import {
  ownerGetBotWelcome,
  ownerSaveBotWelcomeDraft,
  ownerPublishBotWelcome,
  ownerRestoreBotWelcome,
  ownerPreviewBotWelcome,
  type WelcomeButton,
} from "@/lib/bot-welcome.functions";

export const Route = createFileRoute("/_authenticated/owner/welcome")({
  head: () => ({ meta: [{ title: "Bot Welcome — TASKORA" }] }),
  component: OwnerWelcomePage,
});

function OwnerWelcomePage() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [messageText, setMessageText] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [communityUrl, setCommunityUrl] = useState("https://t.me/Taskoraplus");
  const [miniAppUrl, setMiniAppUrl] = useState("");
  const [buttons, setButtons] = useState<WelcomeButton[]>([]);
  const [publishedAt, setPublishedAt] = useState<string | null>(null);
  const [hasPrevious, setHasPrevious] = useState(false);

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const w = await ownerGetBotWelcome();
      setEnabled(w.enabled);
      setMessageText(w.draft_message_text);
      setPhotoUrl(w.draft_photo_url ?? "");
      setCommunityUrl(w.draft_community_url);
      setMiniAppUrl(w.draft_mini_app_url ?? "");
      setButtons(w.draft_buttons);
      setPublishedAt(w.published_at);
      setHasPrevious(Boolean(w.previous_message_text));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function persistDraft() {
    await ownerSaveBotWelcomeDraft({
      data: {
        message_text: messageText,
        buttons,
        photo_url: photoUrl.trim() || null,
        community_url: communityUrl,
        mini_app_url: miniAppUrl.trim() || null,
        enabled,
      },
    });
  }

  async function saveDraft() {
    setBusy("save");
    setMsg(null);
    try {
      await persistDraft();
      setMsg("Draft saved.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(null);
    }
  }

  async function publish() {
    setBusy("publish");
    setMsg(null);
    try {
      await persistDraft();
      const r = await ownerPublishBotWelcome();
      setPublishedAt(r.published_at);
      setHasPrevious(true);
      setMsg("Published — live on /start for all users.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Publish failed");
    } finally {
      setBusy(null);
    }
  }

  async function preview() {
    setBusy("preview");
    setMsg(null);
    try {
      await persistDraft();
      await ownerPreviewBotWelcome();
      setMsg("Preview sent to your Telegram chat.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    setBusy("restore");
    setMsg(null);
    try {
      await ownerRestoreBotWelcome();
      await load();
      setMsg("Previous version restored into draft.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setBusy(null);
    }
  }

  function updateBtn(i: number, patch: Partial<WelcomeButton>) {
    setButtons((prev) => prev.map((b, idx) => (idx === i ? { ...b, ...patch } : b)));
  }

  if (loading) {
    return (
      <main className="mx-auto min-h-screen max-w-md bg-[#0b1424] px-4 pt-8 text-white">
        <p className="text-center text-sm text-slate-400">Loading welcome settings…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#0b1424] px-4 pb-28 pt-4 text-white">
      <div className="mb-4 flex items-center gap-3">
        <Link to="/owner" className="rounded-xl border border-slate-500/20 p-2 text-slate-400">
          <ChevronLeft className="size-4" />
        </Link>
        <img src={TASKORA_LOGO} alt="" className="size-9 rounded-full object-cover ring-1 ring-blue-400/40" />
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-bold">Bot /start Welcome</h1>
          <p className="text-[10px] text-slate-500">
            {publishedAt ? `Last published ${new Date(publishedAt).toLocaleString()}` : "Not published yet"}
          </p>
        </div>
      </div>

      <label className="mb-3 flex items-center justify-between rounded-2xl border border-slate-500/15 bg-[#121f33] px-4 py-3">
        <span className="text-sm font-semibold">Welcome enabled</span>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="size-5 accent-blue-500" />
      </label>

      <section className="mb-3 space-y-2 rounded-2xl border border-slate-500/15 bg-[#121f33] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Welcome photo URL</p>
        <input value={photoUrl} onChange={(e) => setPhotoUrl(e.target.value)} placeholder="https://… (your brand graphic)" className="w-full rounded-xl border border-slate-500/20 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-blue-400/40" />
        {photoUrl ? <img src={photoUrl} alt="" className="mt-2 max-h-40 w-full rounded-xl object-cover" /> : null}
      </section>

      <section className="mb-3 space-y-2 rounded-2xl border border-slate-500/15 bg-[#121f33] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Message · use @username</p>
        <textarea value={messageText} onChange={(e) => setMessageText(e.target.value)} rows={12} className="w-full rounded-xl border border-slate-500/20 bg-black/30 px-3 py-2.5 font-mono text-[12px] leading-relaxed outline-none focus:border-blue-400/40" />
        <p className="text-[10px] text-amber-200/70">Task Points ≠ cash. Keep withdrawable balance separate.</p>
      </section>

      <section className="mb-3 space-y-2 rounded-2xl border border-slate-500/15 bg-[#121f33] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Mini App base URL</p>
        <input value={miniAppUrl} onChange={(e) => setMiniAppUrl(e.target.value)} placeholder="https://your-app.vercel.app" className="w-full rounded-xl border border-slate-500/20 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-blue-400/40" />
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Community link</p>
        <input value={communityUrl} onChange={(e) => setCommunityUrl(e.target.value)} placeholder="https://t.me/…" className="w-full rounded-xl border border-slate-500/20 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-blue-400/40" />
      </section>

      <section className="mb-4 space-y-2 rounded-2xl border border-slate-500/15 bg-[#121f33] p-4">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Buttons</p>
          <button type="button" onClick={() => setButtons((p) => [...p, { id: `btn_${Date.now().toString(36)}`, label: "New", type: "web_app", path: "/home" }])} className="inline-flex items-center gap-1 rounded-lg bg-blue-500/15 px-2 py-1 text-[10px] font-bold text-blue-200">
            <Plus className="size-3" /> Add
          </button>
        </div>
        {buttons.map((b, i) => (
          <div key={b.id} className="rounded-xl border border-slate-500/15 bg-black/25 p-2.5">
            <div className="mb-1.5 flex items-center gap-2">
              <GripVertical className="size-3.5 text-slate-600" />
              <input value={b.label} onChange={(e) => updateBtn(i, { label: e.target.value })} className="min-w-0 flex-1 rounded-lg border border-slate-500/20 bg-black/40 px-2 py-1.5 text-xs outline-none" />
              <button type="button" onClick={() => setButtons((p) => p.filter((_, idx) => idx !== i))} className="rounded-lg p-1.5 text-red-300/80"><Trash2 className="size-3.5" /></button>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <select value={b.type} onChange={(e) => updateBtn(i, { type: e.target.value as WelcomeButton["type"] })} className="rounded-lg border border-slate-500/20 bg-black/40 px-2 py-1.5 text-[11px]">
                <option value="web_app">Mini App</option>
                <option value="url">External URL</option>
              </select>
              {b.type === "web_app" ? (
                <input value={b.path ?? ""} onChange={(e) => updateBtn(i, { path: e.target.value })} placeholder="/path" className="rounded-lg border border-slate-500/20 bg-black/40 px-2 py-1.5 text-[11px] outline-none" />
              ) : (
                <input value={b.url ?? ""} onChange={(e) => updateBtn(i, { url: e.target.value })} placeholder="https://" className="rounded-lg border border-slate-500/20 bg-black/40 px-2 py-1.5 text-[11px] outline-none" />
              )}
            </div>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={!!busy} onClick={() => void saveDraft()} className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-500/20 bg-[#121f33] py-3 text-xs font-bold disabled:opacity-50">
          <Save className="size-3.5" /> {busy === "save" ? "…" : "Save Draft"}
        </button>
        <button type="button" disabled={!!busy} onClick={() => void preview()} className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-blue-400/30 bg-blue-500/10 py-3 text-xs font-bold text-blue-200 disabled:opacity-50">
          <Eye className="size-3.5" /> {busy === "preview" ? "…" : "Preview"}
        </button>
        <button type="button" disabled={!!busy} onClick={() => void publish()} className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 py-3 text-xs font-bold text-[#0b1424] disabled:opacity-50">
          <Send className="size-3.5" /> {busy === "publish" ? "…" : "Publish"}
        </button>
        <button type="button" disabled={!!busy || !hasPrevious} onClick={() => void restore()} className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-amber-400/25 bg-amber-400/10 py-3 text-xs font-bold text-amber-200 disabled:opacity-40">
          <RotateCcw className="size-3.5" /> {busy === "restore" ? "…" : "Restore"}
        </button>
      </div>

      {msg ? <p className="mt-3 rounded-xl border border-slate-500/15 bg-white/5 px-3 py-2 text-center text-xs text-amber-100/90">{msg}</p> : null}

      <p className="mt-4 text-center text-[10px] leading-relaxed text-slate-500">
        Webhook: <code className="text-slate-400">POST /api/telegram-webhook</code>
        <br />
        Run <code className="text-slate-400">BOT_WELCOME_RUN_ONCE.sql</code> in Supabase once.
      </p>
    </main>
  );
}
