import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ownerCreateAnnouncement } from "@/lib/announcements.functions";

export const Route = createFileRoute("/_authenticated/owner/announce")({
  component: OwnerAnnounce,
});

function OwnerAnnounce() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function publish() {
    setBusy(true);
    setMsg(null);
    try {
      await ownerCreateAnnouncement({ data: { title, body } });
      setMsg("Announcement published.");
      setTitle("");
      setBody("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed (need announcements table)");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <h1 className="text-xl font-bold">Broadcast</h1>
      <p className="mt-1 text-xs text-white/45">In-app announcement banner for all taskers</p>
      <div className="mt-4 space-y-3 rounded-2xl border border-white/8 bg-[#12141c] p-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message"
          rows={4}
          className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm"
        />
        <button
          type="button"
          disabled={busy}
          onClick={publish}
          className="w-full rounded-2xl bg-amber-400 py-3 text-sm font-bold text-[#0a0c12] disabled:opacity-50"
        >
          {busy ? "Publishing…" : "Publish announcement"}
        </button>
        {msg ? <p className="text-xs text-white/50">{msg}</p> : null}
      </div>
    </main>
  );
}
