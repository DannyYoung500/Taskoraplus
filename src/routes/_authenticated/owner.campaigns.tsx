import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { ownerListCampaigns, ownerSetCampaignStatus } from "@/lib/owner-more.functions";

export const Route = createFileRoute("/_authenticated/owner/campaigns")({
  component: OwnerCampaignsPage,
});

function OwnerCampaignsPage() {
  const [rows, setRows] = useState<Array<Record<string, unknown>>>([]);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const r = await ownerListCampaigns();
    setRows(r.campaigns as never);
    if (r.error) setMsg(r.error);
  }

  useEffect(() => {
    void refresh().catch((e) => setMsg(e instanceof Error ? e.message : "Load failed"));
  }, []);

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <div className="mb-4 flex items-center gap-2">
        <Link to="/owner" className="rounded-full border border-white/10 p-2 text-white/60">
          <ChevronLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">Campaigns</h1>
          <p className="text-xs text-white/45">Pause · resume · terminate · budget view</p>
        </div>
      </div>
      {msg ? <p className="mb-2 text-xs text-white/50">{msg}</p> : null}
      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-white/8 bg-[#12141c] p-4 text-sm text-white/45">
            No campaigns yet. Publish tasks from Advertise.
          </p>
        ) : (
          rows.map((c) => (
            <div key={String(c.id)} className="rounded-2xl border border-white/8 bg-[#12141c] p-3.5">
              <p className="text-sm font-semibold">{String(c.name ?? c.title ?? c.id)}</p>
              <p className="mt-1 text-[11px] text-white/40">
                {String(c.status)} · budget ${Number(c.budget ?? 0).toFixed(2)} · spent $
                {Number(c.spent ?? 0).toFixed(2)}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {["active", "paused", "terminated", "completed"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="rounded-lg border border-white/10 px-2 py-1 text-[10px] capitalize text-white/70"
                    onClick={() =>
                      void ownerSetCampaignStatus({ data: { id: String(c.id), status: s } })
                        .then(refresh)
                        .catch((e) => setMsg(e instanceof Error ? e.message : "Failed"))
                    }
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
