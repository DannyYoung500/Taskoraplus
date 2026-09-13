import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { createSupportTicket, listMyTickets } from "@/lib/support.functions";
import { Screen, ScreenTitle } from "@/components/Screen";

export const Route = createFileRoute("/_authenticated/support")({
  loader: async () => {
    const tickets = await listMyTickets().catch(() => []);
    return { tickets };
  },
  component: SupportPage,
});

function SupportPage() {
  const { tickets } = Route.useLoaderData();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    setBusy(true);
    setMsg(null);
    try {
      await createSupportTicket({ data: { subject, body } });
      setMsg("Ticket submitted. Owner will review.");
      setSubject("");
      setBody("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not send (table may need SQL).");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScreenTitle title="Support" subtitle="Contact TASKORA owner" />
      <div className="card-surface space-y-3 p-4">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Describe your issue"
          rows={4}
          className="w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm"
        />
        <button
          type="button"
          disabled={busy}
          onClick={send}
          className="bg-green-grad w-full rounded-2xl py-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
        >
          {busy ? "Sending…" : "Submit ticket"}
        </button>
        {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
      </div>
      <div className="mt-6 space-y-2">
        {(tickets as Array<{ id: string; subject: string; status: string; created_at: string }>).map(
          (t) => (
            <div key={t.id} className="card-surface p-3 text-sm">
              <p className="font-semibold">{t.subject}</p>
              <p className="text-[11px] text-muted-foreground">
                {t.status} · {new Date(t.created_at).toLocaleString()}
              </p>
            </div>
          ),
        )}
      </div>
    </Screen>
  );
}
