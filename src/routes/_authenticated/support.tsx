import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { createSupportTicket, listMyTickets, uploadSupportImage } from "@/lib/support.functions";
import { Screen, ScreenTitle, Card, GoldButton } from "@/components/Screen";
import { ImagePlus } from "lucide-react";

export const Route = createFileRoute("/_authenticated/support")({
  loader: async () => {
    const tickets = await listMyTickets().catch(() => []);
    return { tickets };
  },
  head: () => ({ meta: [{ title: "Support — TASKORA" }] }),
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
          className="w-full rounded-xl bg-[#1a1a1a] px-3.5 py-2.5 text-sm font-normal text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-orange-500/40"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Describe your issue"
          rows={4}
          className="w-full rounded-xl bg-[#1a1a1a] px-3.5 py-2.5 text-sm font-normal text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-orange-500/40"
        />

        <div className="rounded-xl bg-[#1a1a1a] p-3">
          <p className="mb-2 text-[11px] font-medium text-neutral-500">Screenshot (optional)</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-orange-500/15 px-3 py-2 text-[11px] font-medium text-orange-400 disabled:opacity-50"
            >
              <ImagePlus className="size-3.5" strokeWidth={1.75} />
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
            className="mt-2 w-full rounded-lg bg-[#121212] px-3 py-2 text-xs font-normal text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-orange-500/30"
          />
          {preview ? (
            <div className="mt-2 overflow-hidden rounded-lg">
              <img src={preview} alt="" className="max-h-40 w-full object-contain" />
            </div>
          ) : null}
        </div>

        {msg ? (
          <p className="text-[12px] font-normal text-orange-300">{msg}</p>
        ) : null}

        <GoldButton disabled={busy || !subject.trim() || !body.trim()} onClick={() => void send()}>
          {busy ? "Sending…" : "Submit ticket"}
        </GoldButton>
      </Card>

      {list.length > 0 ? (
        <div className="mt-5 space-y-2.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-neutral-500">Your tickets</p>
          {list.map((t) => (
            <Card key={t.id} className="p-3.5">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[13px] font-medium text-neutral-100">{t.subject}</p>
                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-[10px] font-medium ${
                    t.status === "open" || t.status === "pending"
                      ? "bg-orange-500/15 text-orange-400"
                      : t.status === "resolved" || t.status === "closed"
                        ? "bg-emerald-500/15 text-emerald-400"
                        : "bg-neutral-800 text-neutral-400"
                  }`}
                >
                  {t.status}
                </span>
              </div>
              {t.body ? (
                <p className="mt-1.5 line-clamp-2 text-[11px] font-normal text-neutral-500">{t.body}</p>
              ) : null}
              {t.owner_reply ? (
                <p className="mt-2 rounded-lg bg-orange-500/10 px-2.5 py-2 text-[11px] font-normal text-orange-200">
                  Owner: {t.owner_reply}
                </p>
              ) : null}
              <p className="mt-1.5 text-[10px] font-normal text-neutral-600">
                {new Date(t.created_at).toLocaleString()}
              </p>
            </Card>
          ))}
        </div>
      ) : null}
    </Screen>
  );
}
