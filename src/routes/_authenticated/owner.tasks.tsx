import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ownerListTasks, ownerSetTaskStatus } from "@/lib/owner.functions";

export const Route = createFileRoute("/_authenticated/owner/tasks")({
  loader: async () => {
    try {
      const rows = await ownerListTasks({ data: {} });
      return { rows, error: null as string | null };
    } catch (e) {
      return {
        rows: [] as Awaited<ReturnType<typeof ownerListTasks>>,
        error: e instanceof Error ? e.message : "Owner required",
      };
    }
  },
  component: OwnerTasks,
});

function OwnerTasks() {
  const initial = Route.useLoaderData();
  const [rows, setRows] = useState(initial.rows);
  const [msg, setMsg] = useState(initial.error);

  async function setStatus(
    taskId: string,
    status: "draft" | "active" | "paused" | "completed" | "cancelled",
  ) {
    setMsg(null);
    try {
      await ownerSetTaskStatus({ data: { taskId, status } });
      const next = await ownerListTasks({ data: {} });
      setRows(next);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <h1 className="text-xl font-bold">Task management</h1>
      <p className="mt-1 text-xs text-white/45">Activate · pause · complete campaigns</p>
      {msg ? <p className="mt-2 text-xs text-amber-200/80">{msg}</p> : null}

      <div className="mt-4 space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-white/8 bg-[#12141c] p-4 text-sm text-white/50">
            No tasks. Publish from Advertise.
          </p>
        ) : (
          rows.map((t) => (
            <div key={t.id} className="rounded-2xl border border-white/8 bg-[#12141c] p-3.5">
              <div className="flex justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{t.title}</p>
                  <p className="text-[11px] text-white/40">
                    {t.platform} · ${Number(t.reward).toFixed(2)} · slots {t.slots_left}
                    {t.submissionCount != null ? ` · ${t.submissionCount} subs` : ""}
                  </p>
                </div>
                <span className="text-[10px] font-semibold uppercase text-amber-300">
                  {String(t.status ?? (t.is_active ? "active" : "off"))}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {(["active", "paused", "completed", "cancelled"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(t.id, s)}
                    className="rounded-lg border border-white/10 px-2 py-1 text-[10px] capitalize"
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
