import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Upload, Trash2, Download, ChevronLeft } from "lucide-react";
import {
  listOwnerDocuments,
  createOwnerDocUploadUrl,
  registerOwnerDocument,
  getOwnerDocumentDownloadUrl,
  deleteOwnerDocument,
  type OwnerDocument,
} from "@/lib/owner-docs.functions";

export const Route = createFileRoute("/_authenticated/owner/documents")({
  component: OwnerDocumentsPage,
});

function OwnerDocumentsPage() {
  const [docs, setDocs] = useState<OwnerDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function refresh() {
    setLoading(true);
    try {
      setDocs(await listOwnerDocuments());
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not load documents.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onFile(file: File | null) {
    if (!file) return;
    if (file.size > 25 * 1024 * 1024) {
      setMessage("Max file size is 25MB.");
      return;
    }
    setUploading(true);
    setMessage(null);
    try {
      const signed = await createOwnerDocUploadUrl({
        data: { fileName: file.name, mimeType: file.type || "application/pdf" },
      });
      const put = await fetch(signed.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type || "application/pdf" },
        body: file,
      });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      await registerOwnerDocument({
        data: {
          title: title.trim() || file.name,
          description: description.trim() || undefined,
          fileName: file.name,
          filePath: signed.path,
          fileSize: file.size,
          mimeType: file.type || "application/pdf",
          category: "brief",
        },
      });
      setTitle("");
      setDescription("");
      setMessage("PDF uploaded.");
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function download(id: string) {
    try {
      const { url } = await getOwnerDocumentDownloadUrl({ data: { id } });
      window.open(url, "_blank");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Download failed.");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this document?")) return;
    try {
      await deleteOwnerDocument({ data: { id } });
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Delete failed.");
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <div className="mb-4 flex items-center gap-2">
        <Link to="/owner" className="rounded-full border border-white/10 p-2 text-white/60">
          <ChevronLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Documents</h1>
          <p className="text-xs text-white/45">Upload long PDFs · task briefs · policies</p>
        </div>
      </div>

      <section className="rounded-3xl border border-amber-300/15 bg-[#12141c] p-4">
        <p className="text-sm font-semibold text-amber-200">Upload PDF</p>
        <p className="mt-1 text-[11px] text-white/40">Max 25MB · PDF or image · private storage</p>
        <input
          className="mt-3 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-amber-300/40"
          placeholder="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="mt-2 w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm outline-none focus:border-amber-300/40"
          rows={2}
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,image/*"
          className="mt-3 block w-full text-xs text-white/50 file:mr-3 file:rounded-xl file:border-0 file:bg-amber-400 file:px-3 file:py-2 file:text-xs file:font-bold file:text-[#05070c]"
          disabled={uploading}
          onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
        />
        {uploading ? (
          <p className="mt-2 text-xs text-amber-300">Uploading…</p>
        ) : (
          <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-white/35">
            <Upload className="size-3" /> Choose file to start upload
          </p>
        )}
        {message ? <p className="mt-2 text-center text-xs text-white/55">{message}</p> : null}
      </section>

      <p className="mb-2 mt-6 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Library</p>
      {loading ? (
        <p className="text-sm text-white/40">Loading…</p>
      ) : docs.length === 0 ? (
        <p className="rounded-2xl border border-white/8 bg-[#12141c] p-4 text-sm text-white/45">
          No documents yet. Upload a PDF for long task briefs or policies.
        </p>
      ) : (
        <div className="space-y-2">
          {docs.map((d) => (
            <div key={d.id} className="rounded-2xl border border-white/8 bg-[#12141c] p-3.5">
              <div className="flex items-start gap-3">
                <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/12 text-amber-300">
                  <FileText className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{d.title}</p>
                  <p className="text-[11px] text-white/40">
                    {d.fileName}
                    {d.fileSize ? ` · ${(d.fileSize / 1024).toFixed(0)} KB` : ""}
                  </p>
                  {d.description ? (
                    <p className="mt-1 line-clamp-2 text-[11px] text-white/50">{d.description}</p>
                  ) : null}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => void download(d.id)}
                  className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-white/10 py-2 text-xs font-semibold text-white/70"
                >
                  <Download className="size-3.5" /> Open
                </button>
                <button
                  type="button"
                  onClick={() => void remove(d.id)}
                  className="inline-flex items-center justify-center rounded-xl border border-red-400/30 px-3 py-2 text-red-300"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
