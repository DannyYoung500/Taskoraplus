import { createFileRoute } from "@tanstack/react-router";
import { getLeaderboard } from "@/lib/leaderboard.functions";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  loader: async () => {
    try {
      const rows = await getLeaderboard();
      return { rows, error: null as string | null };
    } catch (e) {
      return {
        rows: [] as Awaited<ReturnType<typeof getLeaderboard>>,
        error: e instanceof Error ? e.message : "Unavailable",
      };
    }
  },
  component: LeaderboardPage,
});

function LeaderboardPage() {
  const { rows, error } = Route.useLoaderData();

  return (
    <main className="mx-auto min-h-screen w-full max-w-md px-4 pb-28 pt-6">
      <h1 className="text-xl font-bold">Leaderboard</h1>
      <p className="mt-1 text-xs text-muted-foreground">Ranked by lifetime positive ledger amounts.</p>
      {error ? <p className="mt-3 text-xs text-warning">{error}</p> : null}
      <div className="mt-4 space-y-2">
        {rows.length === 0 ? (
          <p className="card-surface p-4 text-sm text-muted-foreground">No rankings yet.</p>
        ) : (
          rows.map((r, i) => (
            <div key={r.user_id} className="card-surface flex items-center gap-3 p-3">
              <span className="w-6 text-sm font-bold text-muted-foreground">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.display_name}</p>
              </div>
              <span className="text-sm font-bold text-primary">${Number(r.earned).toFixed(2)}</span>
            </div>
          ))
        )}
      </div>
    </main>
  );
}
