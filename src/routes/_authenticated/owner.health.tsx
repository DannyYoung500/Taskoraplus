import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { getSystemHealth } from "@/lib/owner-ops.functions";

export const Route = createFileRoute("/_authenticated/owner/health")({
  component: OwnerHealthPage,
});

function OwnerHealthPage() {
  const [data, setData] = useState<{
    overall: string;
    checks: Array<{ name: string; status: string; detail: string }>;
    checkedAt: string;
  } | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void getSystemHealth()
      .then(setData)
      .catch((e) => setMsg(e instanceof Error ? e.message : "Load failed"));
  }, []);

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <div className="mb-4 flex items-center gap-2">
        <Link to="/owner" className="rounded-full border border-white/10 p-2 text-white/60">
          <ChevronLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">System Health</h1>
          <p className="text-xs text-white/45">Live probes · no secrets shown</p>
        </div>
      </div>
      {msg ? <p className="text-xs text-white/50">{msg}</p> : null}
      {data ? (
        <>
          <p className="mb-3 text-sm">
            Overall:{" "}
            <span
              className={
                data.overall === "ok"
                  ? "text-emerald-400"
                  : data.overall === "warn"
                    ? "text-amber-300"
                    : "text-red-400"
              }
            >
              {data.overall.toUpperCase()}
            </span>
          </p>
          <div className="space-y-2">
            {data.checks.map((c) => (
              <div
                key={c.name}
                className="rounded-2xl border border-white/8 bg-[#12141c] px-4 py-3"
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{c.name}</p>
                  <span
                    className={
                      c.status === "ok"
                        ? "text-emerald-400"
                        : c.status === "warn"
                          ? "text-amber-300"
                          : "text-red-400"
                    }
                  >
                    {c.status}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-white/45">{c.detail}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-center text-[10px] text-white/30">{data.checkedAt}</p>
        </>
      ) : (
        <p className="text-sm text-white/40">Checking…</p>
      )}
    </main>
  );
}
