import { createFileRoute, Link } from "@tanstack/react-router";
import { listTasks, getDashboard } from "@/lib/taskora.functions";

const LOGO = "/file_00000000f8ec8246a98cce68ff972640.png";

export const Route = createFileRoute("/_authenticated/home")({
  loader: async () => {
    const [tasks, dash] = await Promise.all([
      listTasks().catch(() => []),
      getDashboard().catch(() => null),
    ]);
    return { tasks: tasks.slice(0, 6), dash };
  },
  component: HomePage,
});

function HomePage() {
  const { tasks, dash } = Route.useLoaderData();
  const balance = Number(dash?.balance ?? 0);
  const pending = Number(dash?.pending ?? 0);
  const name = dash?.profile?.display_name ?? "Tasker";
  const isOwner = Boolean(dash?.isOwner);

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-28 pt-5">
      <header className="mb-5 flex items-center gap-3">
        <img src={LOGO} alt="" className="size-10 rounded-full object-cover" />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">TASKORA</p>
          <h1 className="truncate text-lg font-bold">{name}</h1>
        </div>
        <Link
          to="/wallet"
          className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-bold text-primary"
        >
          ${balance.toFixed(2)}
        </Link>
      </header>

      {isOwner ? (
        <Link
          to="/owner"
          className="mb-4 block rounded-2xl border border-primary/40 bg-primary/10 px-4 py-3 text-sm font-bold text-primary"
        >
          Owner Control Center →
        </Link>
      ) : null}

      <section className="bg-brand relative mb-4 overflow-hidden rounded-3xl p-5 shadow-raised">
        <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "var(--gradient-sheen)" }} />
        <div className="relative grid grid-cols-2 gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Available</p>
            <p className="mt-1 text-2xl font-bold text-primary">${balance.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Pending</p>
            <p className="mt-1 text-2xl font-bold">${pending.toFixed(2)}</p>
          </div>
        </div>
      </section>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <Link to="/tasks" className="card-surface p-3 text-center text-xs font-semibold">
          Browse tasks
        </Link>
        <Link to="/watch-earn" className="card-surface p-3 text-center text-xs font-semibold">
          Watch & Earn
        </Link>
        <Link to="/ambassador" className="card-surface p-3 text-center text-xs font-semibold">
          Invite & earn
        </Link>
        <Link to="/leaderboard" className="card-surface p-3 text-center text-xs font-semibold">
          Leaderboard
        </Link>
      </div>

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
              className="card-surface flex items-center justify-between p-3.5"
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
    </main>
  );
}
