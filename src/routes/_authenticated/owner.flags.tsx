import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { listFeatureFlags, setFeatureFlag, setMaintenanceMode } from "@/lib/owner-ops.functions";

export const Route = createFileRoute("/_authenticated/owner/flags")({
  component: OwnerFlagsPage,
});

function OwnerFlagsPage() {
  const [flags, setFlags] = useState<Array<{ key: string; enabled: boolean; label: string | null }>>([]);
  const [maint, setMaint] = useState({
    read_only: false,
    withdrawals_paused: false,
    deposits_paused: false,
    task_creation_paused: false,
    verification_paused: false,
  });
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh() {
    const r = await listFeatureFlags();
    setFlags(r.flags as never);
    setMaint(r.maintenance as never);
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
          <h1 className="text-xl font-bold">Feature Flags</h1>
          <p className="text-xs text-white/45">Kill switches · maintenance modes · audited</p>
        </div>
      </div>

      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Maintenance</p>
      <div className="mb-5 space-y-2 rounded-2xl border border-white/8 bg-[#12141c] p-3">
        {(
          [
            ["read_only", "Read-only mode"],
            ["withdrawals_paused", "Withdrawals paused"],
            ["deposits_paused", "Deposits paused"],
            ["task_creation_paused", "Task creation paused"],
            ["verification_paused", "Verification paused"],
          ] as const
        ).map(([k, label]) => (
          <label key={k} className="flex items-center justify-between text-sm text-white/70">
            {label}
            <input
              type="checkbox"
              className="size-4 accent-amber-400"
              checked={Boolean((maint as Record<string, boolean>)[k])}
              onChange={(e) => {
                const next = { ...maint, [k]: e.target.checked };
                setMaint(next);
                void setMaintenanceMode({ data: next })
                  .then(() => setMsg("Maintenance updated"))
                  .catch((err) => setMsg(err instanceof Error ? err.message : "Failed"));
              }}
            />
          </label>
        ))}
      </div>

      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">Flags</p>
      <div className="space-y-2">
        {flags.map((f) => (
          <label
            key={f.key}
            className="flex items-center justify-between rounded-2xl border border-white/8 bg-[#12141c] px-4 py-3 text-sm"
          >
            <span>
              <span className="font-semibold">{f.label ?? f.key}</span>
              <span className="mt-0.5 block text-[10px] text-white/35">{f.key}</span>
            </span>
            <input
              type="checkbox"
              className="size-4 accent-amber-400"
              checked={f.enabled}
              onChange={(e) => {
                void setFeatureFlag({ data: { key: f.key, enabled: e.target.checked } })
                  .then(refresh)
                  .catch((err) => setMsg(err instanceof Error ? err.message : "Failed"));
              }}
            />
          </label>
        ))}
      </div>
      {msg ? <p className="mt-4 text-center text-xs text-white/50">{msg}</p> : null}
    </main>
  );
}
