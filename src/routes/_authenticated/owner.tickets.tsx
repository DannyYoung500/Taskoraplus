import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ownerCloseTicket, ownerListTickets, ownerReplyTicket } from "@/lib/support.functions";
import { AppLink } from "@/components/AppLink";
import { ChevronLeft } from "lucide-react";

export const Route = createFileRoute("/_authenticated/owner/tickets")({
  loader: async () => {
    try {
      const rows = await ownerListTickets();
      return { rows, error: null as string | null };
    } catch (e) {
      return {
        rows: [] as Awaited<ReturnType<typeof ownerListTickets>>,
        error: e instanceof Error ? e.message : "Owner required",
      };
    }
  },
  component: OwnerTickets,
});

function OwnerTickets() {
  const initial = Route.useLoaderData();
  const [rows, setRows] = useState(initial.rows as Array<Record<string, unknown>>);
  const [msg, setMsg] = useState(initial.error);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  async function close(id: string) {
    setBusy(id);
    try {
      await ownerCloseTicket({ data: { ticketId: id } });
      setRows((r) => r.map((t) => (t.id === id ? { ...t, status: "closed" } : t)));
      setMsg("Ticket closed");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(null);
    }
  }

  async function reply(id: string) {
    const text = (replies[id] || "").trim();
    if (text.length < 2) {
      setMsg("Write a reply first");
      return;
    }
    setBusy(id);
    try {
      await ownerReplyTicket({ data: { ticketId: id, reply: text } });
      setRows((r) =>
        r.map((t) => (t.id === id ? { ...t, status: "replied", owner_reply: text } : t)),
      );
      setReplies((prev) => ({ ...prev, [id]: "" }));
      setMsg("Reply saved");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Reply failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <div className="mb-3 flex items-center gap-2">
        <AppLink to="/owner" className="rounded-full border border-white/10 p-2 text-white/60">
          <ChevronLeft className="size-4" />
        </AppLink>
        <div>
          <h1 className="text-xl font-bold">Support tickets</h1>
          <p className="text-[10px] text-white/40">Reply · close · ops</p>
        </div>
      </div>
      {msg ? <p className="mb-2 text-xs text-cyan-300">{msg}</p> : null}
      <div className="mt-2 space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-white/8 bg-[#12141c] p-4 text-sm text-white/50">
            No tickets (or table not migrated yet).
          </p>
        ) : (
          rows.map((t) => {
            const id = String(t.id);
            const status = String(t.status ?? "open");
            return (
              <div key={id} className="rounded-2xl border border-white/8 bg-[#12141c] p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-white">{String(t.subject ?? "")}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                      status === "open"
                        ? "bg-amber-500/15 text-amber-200"
                        : status === "replied"
                          ? "bg-cyan-500/15 text-cyan-200"
                          : "bg-white/10 text-white/50"
                    }`}
                  >
                    {status}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-white/50">{String(t.body ?? "")}</p>
                {t.owner_reply ? (
                  <p className="mt-2 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-2.5 py-2 text-[11px] text-cyan-100">
                    <span className="font-bold">Owner: </span>
                    {String(t.owner_reply)}
                  </p>
                ) : null}
                {status !== "closed" ? (
                  <div className="mt-2 space-y-2">
                    <textarea
                      value={replies[id] ?? ""}
                      onChange={(e) => setReplies((prev) => ({ ...prev, [id]: e.target.value }))}
                      placeholder="Write a reply…"
                      rows={2}
                      className="w-full rounded-xl border border-white/10 bg-[#0a0c12] px-3 py-2 text-[12px] text-white outline-none focus:border-cyan-400/40"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={busy === id}
                        onClick={() => void reply(id)}
                        className="flex-1 rounded-xl bg-cyan-400 py-2 text-[11px] font-extrabold text-[#05070c] disabled:opacity-50"
                      >
                        Send reply
                      </button>
                      <button
                        type="button"
                        disabled={busy === id}
                        onClick={() => void close(id)}
                        className="rounded-xl border border-amber-400/30 px-3 py-2 text-[11px] font-bold text-amber-200 disabled:opacity-50"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
