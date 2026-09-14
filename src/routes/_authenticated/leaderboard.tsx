import { createFileRoute } from "@tanstack/react-router";
import { Trophy } from "lucide-react";
import { getLeaderboard } from "@/lib/leaderboard.functions";
import { Screen, ScreenTitle, Card } from "@/components/Screen";

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
    <Screen>
      <ScreenTitle title="Leaderboard" subtitle="Ranked by lifetime earnings" />
      {error ? <p className="mb-3 text-xs text-amber-200/80">{error}</p> : null}
      <div className="space-y-2">
        {rows.length === 0 ? (
          <Card className="p-4 text-sm text-white/45">No rankings yet. Complete tasks to climb.</Card>
        ) : (
          rows.map((r, i) => (
            <Card key={r.user_id} className="flex items-center gap-3 p-3">
              <span className="flex size-8 items-center justify-center rounded-full bg-amber-400/12 text-sm font-bold text-amber-300">
                {i < 3 ? <Trophy className="size-3.5" /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.display_name}</p>
              </div>
              <span className="text-sm font-bold text-amber-300">${Number(r.earned).toFixed(2)}</span>
            </Card>
          ))
        )}
      </div>
    </Screen>
  );
}
