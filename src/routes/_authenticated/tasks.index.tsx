import { createFileRoute, Link } from "@tanstack/react-router";
import { listTasks } from "@/lib/taskora.functions";
import { PlatformIcon, type Platform } from "@/components/PlatformIcon";

export const Route = createFileRoute("/_authenticated/tasks/")({
  loader: async () => {
    const tasks = await listTasks().catch(() => []);
    return { tasks };
  },
  component: TasksPage,
});

function TasksPage() {
  const { tasks } = Route.useLoaderData();

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <h1 className="text-xl font-bold">Browse Tasks</h1>
      <p className="mt-1 text-xs text-white/45">Verified tasks · real rewards</p>

      <div className="mt-4 space-y-2.5">
        {tasks.length === 0 ? (
          <p className="rounded-2xl border border-white/8 bg-[#12141c] p-5 text-sm text-white/50">
            No live tasks yet. Owner can publish from Advertise.
          </p>
        ) : (
          tasks.map(
            (t: {
              id: string;
              title: string;
              reward: number;
              platform: string;
              advertiser?: string;
              seconds?: number;
              slots_left?: number;
            }) => (
              <Link
                key={t.id}
                to="/tasks/$taskId"
                params={{ taskId: t.id }}
                className="flex items-center gap-3 rounded-2xl border border-white/8 bg-[#12141c] p-3.5"
              >
                <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/5">
                  <PlatformIcon platform={t.platform as Platform} size={22} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{t.title}</p>
                  <p className="text-[11px] text-white/40">
                    {t.platform}
                    {t.advertiser ? ` · ${t.advertiser}` : ""}
                    {typeof t.slots_left === "number" ? ` · ${t.slots_left} slots` : ""}
                  </p>
                </div>
                <span className="rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-bold text-amber-300">
                  +${Number(t.reward).toFixed(2)}
                </span>
              </Link>
            ),
          )
        )}
      </div>
    </main>
  );
}
