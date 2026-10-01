import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { createSupportTicket, listMyTickets, uploadSupportImage } from "@/lib/support.functions";
import { Screen, ScreenTitle, Card, GoldButton } from "@/components/Screen";
import { ImagePlus, Paperclip } from "lucide-react";

export const Route = createFileRoute("/_authenticated/support")({
  loader: async () => {
    const tickets = await listMyTickets().catch(() => []);
    return { tickets };
  },
  component: SupportPage,
});

type Ticket = {
  id: string;
  subject: string;
  body?: string;
  status: string;
  created_at: string;
  owner_reply?: string | null;
  attachment_url?: string | null;
};

function SupportPage() {
  const { tickets } = Route.useLoaderData();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [list, setList] = useState((tickets as Ticket[]) ?? []);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPickFile(file: File | null) {
    if (!file) return;
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) {
      setMsg("Use JPEG, PNG, or WebP only.");
      return;
    }
    if (file.size > 2.5 * 1024 * 1024) {
      setMsg("Image max 2.5 MB.");
      return;
    }
    setUploading(true);
    setMsg(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Could not read file"));
        reader.readAsDataURL(file);
      });
      setPreview(dataUrl);
      const res = await uploadSupportImage({ data: { dataUrl } });
      setAttachmentUrl(res.url);
      setMsg("Image uploaded — attach ready.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Upload failed");
      setPreview(null);
      setAttachmentUrl("");
    } finally {
      setUploading(false);
    }
  }

  async function send() {
    setBusy(true);
    setMsg(null);
    try {
      const row = await createSupportTicket({
        data: { subject, body, attachmentUrl: attachmentUrl.trim() || undefined },
      });
      setMsg("Ticket submitted. Owner will review.");
      setSubject("");
      setBody("");
      setAttachmentUrl("");
      setPreview(null);
      if (row) setList((prev) => [row as Ticket, ...prev]);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not send (run SQL if table missing).");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScreenTitle title="Support" subtitle="Contact TASKORA owner · upload screenshot · replies below" />
      <Card className="space-y-3 p-4">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-300/40"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Describe your issue"
          rows={4}
          className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-cyan-300/40"
        />

        <div className="rounded-xl border border-dashed border-white/15 bg-black/20 p-3">
          <p className="mb-2 text-[11px] font-semibold text-white/50">Screenshot (optional)</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-400/10 px-3 py-2 text-[11px] font-bold text-cyan-100 disabled:opacity-50"
            >
              <ImagePlus className="size-3.5" />
              {uploading ? "Uploading…" : "Upload image"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => void onPickFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <input
            value={attachmentUrl}
            onChange={(e) => {
              setAttachmentUrl(e.target.value);
              setPreview(null);
            }}
            placeholder="Or paste image URL (https://…)"
            inputMode="url"
            className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-xs text-white outline-none placeholder:text-white/25"
          />
          {(preview || attachmentUrl) && (
            <div className="mt-2 overflow-hidden rounded-lg border border-white/10">
              <img
                src={preview || attachmentUrl}
                alt="Attachment preview"
                className="max-h-40 w-full object-contain bg-black/40"
              />
            </div>
          )}
        </div>

        <GoldButton disabled={busy || uploading} onClick={() => void send()}>
          {busy ? "Sending…" : "Submit ticket"}
        </GoldButton>
        {msg ? <p className="text-xs text-white/50">{msg}</p> : null}
      </Card>
      <div className="mt-6 space-y-2">
        {list.map((t) => (
          <Card key={t.id} className="space-y-1.5 p-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{t.subject}</p>
              <span className="text-[10px] uppercase text-white/40">{t.status}</span>
            </div>
            {t.body ? <p className="text-[11px] text-white/45">{t.body}</p> : null}
            {t.attachment_url ? (
              <a
                href={t.attachment_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-sky-300 underline"
              >
                <Paperclip className="size-3" />
                Attachment
              </a>
            ) : null}
            {t.owner_reply ? (
              <p className="rounded-lg border border-cyan-400/20 bg-cyan-400/5 px-2.5 py-2 text-[11px] text-cyan-100">
                <span className="font-bold">Owner reply: </span>
                {t.owner_reply}
              </p>
            ) : null}
            <p className="text-[10px] text-white/35">
              {t.created_at ? new Date(t.created_at).toLocaleString() : ""}
            </p>
          </Card>
        ))}
      </div>
    </Screen>
  );
}
