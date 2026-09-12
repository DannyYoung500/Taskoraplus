import { createFileRoute, Link } from "@tanstack/react-router";
import { listTasks, getDashboard } from "@/lib/taskora.functions";

export const Route = createFileRoute("/_authenticated/home")({
  loader: async () => {
    const [tasks, dash] = await Promise.all([
      listTasks().catch(() => []),
      getDashboard().catch(() => null),
    ]);
    return { tasks: tasks.slice(0, 5), dash };
  },
  component: HomePage,
});

function HomePage() {
  const { tasks, dash } = Route.useLoaderData();
  const balance = dash?.balance ?? 0;
  const pending = dash?.pending ?? 0;
  const name = dash?.profile?.display_name ?? "Tasker";

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-28 pt-6">
      <header className="mb-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Welcome back</p>
          <h1 className="text-xl font-bold">{name}</h1>
        </div>
        <Link
          to="/wallet"
          className="rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground"
        >
          ${Number(balance).toFixed(2)}
        </Link>
      </header>

      <section className="card-surface mb-4 grid grid-cols-2 gap-3 p-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Available</p>
          <p className="text-lg font-bold">${Number(balance).toFixed(2)}</p>
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Pending</p>
          <p className="text-lg font-bold">${Number(pending).toFixed(2)}</p>
        </div>
      </section>

      <section className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Earn today</h2>
        <Link to="/tasks" className="text-xs font-semibold text-primary">
          View all
        </Link>
      </section>

      <div className="space-y-2">
        {tasks.length === 0 ? (
          <p className="card-surface p-4 text-sm text-muted-foreground">No tasks available right now.</p>
        ) : (
          tasks.map((t: { id: string; title: string; reward: number; platform: string }) => (
            <Link
              key={t.id}
              to="/tasks/$taskId"
              params={{ taskId: t.id }}
              className="card-surface flex items-center justify-between p-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{t.title}</p>
                <p className="text-xs text-muted-foreground">{t.platform}</p>
              </div>
              <span className="text-sm font-bold text-primary">+${Number(t.reward).toFixed(2)}</span>
            </Link>
          ))
        )}
      </div>

      <Link
        to="/watch-earn"
        className="mt-4 block rounded-2xl border border-border p-4 text-sm font-semibold"
      >
        Watch & Earn — open rewarded videos
      </Link>
    </main>
  );
}
