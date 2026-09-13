import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ownerCloseTicket, ownerListTickets } from "@/lib/support.functions";

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
  const [rows, setRows] = useState(initial.rows);
  const [msg, setMsg] = useState(initial.error);

  async function close(id: string) {
    try {
      await ownerCloseTicket({ data: { ticketId: id } });
      setRows((r) => r.map((t) => (t.id === id ? { ...t, status: "closed" } : t)));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <h1 className="text-xl font-bold">Support tickets</h1>
      {msg ? <p className="mt-2 text-xs text-amber-200">{msg}</p> : null}
      <div className="mt-4 space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-white/8 bg-[#12141c] p-4 text-sm text-white/50">
            No tickets (or table not migrated yet).
          </p>
        ) : (
          rows.map((t) => (
            <div key={t.id} className="rounded-2xl border border-white/8 bg-[#12141c] p-3.5">
              <p className="text-sm font-semibold">{t.subject}</p>
              <p className="mt-1 text-xs text-white/50">{t.body}</p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-white/40">{t.status}</span>
                {t.status === "open" ? (
                  <button
                    type="button"
                    onClick={() => close(t.id)}
                    className="rounded-lg border border-amber-400/30 px-2 py-1 text-[10px] text-amber-300"
                  >
                    Close
                  </button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
