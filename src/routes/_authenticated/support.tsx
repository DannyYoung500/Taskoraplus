import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { createSupportTicket, listMyTickets } from "@/lib/support.functions";
import { Screen, ScreenTitle, Card, GoldButton } from "@/components/Screen";

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
      setMsg(e instanceof Error ? e.message : "Could not send (run SQL if table missing).");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <ScreenTitle title="Support" subtitle="Contact TASKORA owner" />
      <Card className="space-y-3 p-4">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject"
          className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-amber-300/40"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Describe your issue"
          rows={4}
          className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2.5 text-sm text-white outline-none placeholder:text-white/25 focus:border-amber-300/40"
        />
        <GoldButton disabled={busy} onClick={() => void send()}>
          {busy ? "Sending…" : "Submit ticket"}
        </GoldButton>
        {msg ? <p className="text-xs text-white/50">{msg}</p> : null}
      </Card>
      <div className="mt-6 space-y-2">
        {(tickets as Array<{ id: string; subject: string; status: string; created_at: string }>).map(
          (t) => (
            <Card key={t.id} className="p-3 text-sm">
              <p className="font-semibold">{t.subject}</p>
              <p className="text-[11px] text-white/40">
                {t.status} · {new Date(t.created_at).toLocaleString()}
              </p>
            </Card>
          ),
        )}
      </div>
    </Screen>
  );
}
