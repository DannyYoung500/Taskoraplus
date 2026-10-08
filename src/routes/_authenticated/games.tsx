import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Gamepad2,
  Play,
  Search,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";
import { getDashboard } from "@/lib/taskora.functions";
import { getAvailableGames, type AvailableGame } from "@/lib/game.functions";
import { TASKORA_LOGO, ACCENT_GRAD } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/games")({
  loader: async () => {
    const [games, dash] = await Promise.all([
      getAvailableGames().catch(() => []),
      getDashboard().catch(() => null),
    ]);
    return { games, dash };
  },
  component: GamesPage,
});

function GamesPage() {
  const { games: initialGames, dash } = Route.useLoaderData();
  const [games] = useState<AvailableGame[]>(initialGames);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  const categories = useMemo(() => {
    const values = Array.from(new Set(games.map((game) => game.category.trim()).filter(Boolean)));
    return ["All", ...values];
  }, [games]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return games.filter((game) => {
      const matchesCategory = category === "All" || game.category === category;
      const haystack = [game.title, game.providerName, game.category, game.description ?? ""]
        .join(" ")
        .toLowerCase();
      return matchesCategory && (!q || haystack.includes(q));
    });
  }, [games, query, category]);

  const featured = filtered.filter((game) => game.featured);
  const regular = filtered.filter((game) => !game.featured);
  const profile = dash?.profile as { task_points?: number | null } | null;
  const points = Number(profile?.task_points ?? 0);

  return (
    <main className="mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-[#080808] pb-28 text-neutral-100">
      <header className="sticky top-0 z-30 bg-[#080808]/95 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <Link to="/home" aria-label="Back" className="p-2 text-neutral-400">
            <ArrowLeft className="size-5" strokeWidth={1.75} />
          </Link>
          <img src={TASKORA_LOGO} alt="TASKORA" className="size-8 rounded-lg" />
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold text-neutral-50">Games</p>
            <p className="text-[10px] font-normal text-neutral-500">Play · Earn</p>
          </div>
          <Link to="/wallet" aria-label="Wallet" className="p-2 text-orange-400">
            <WalletCards className="size-5" strokeWidth={1.75} />
          </Link>
        </div>
      </header>

      <section className="px-4 pt-3">
        <div className="relative overflow-hidden rounded-2xl bg-[#121212] p-4">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-orange-400">
            <Sparkles className="size-3" strokeWidth={1.75} /> Marketplace
          </span>
          <h1 className="mt-2 text-[22px] font-semibold leading-tight text-neutral-50">
            Play games.
            <br />
            Earn rewards.
          </h1>
          <p className="mt-2 text-[12px] font-normal leading-relaxed text-neutral-500">
            Live games from configured providers. Rewards from owner settings.
          </p>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-[#0a0a0a] px-3 py-2.5">
            <div>
              <p className="text-[9px] font-normal text-neutral-600">Task points</p>
              <p className="text-[16px] font-medium tabular-nums text-neutral-100">
                {points.toLocaleString()}
              </p>
            </div>
            <Link
              to="/wallet"
              className="flex items-center gap-1 text-[11px] font-medium text-orange-400"
            >
              Wallet <ChevronRight className="size-3" strokeWidth={1.75} />
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 pt-4">
        <div className="flex items-center gap-2 rounded-2xl bg-[#121212] px-3">
          <Search className="size-4 text-neutral-500" strokeWidth={1.75} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search games"
            className="min-w-0 flex-1 bg-transparent py-3 text-[13px] font-normal text-neutral-100 outline-none placeholder:text-neutral-600"
          />
          {query ? (
            <button type="button" aria-label="Clear" onClick={() => setQuery("")} className="text-neutral-500">
              <X className="size-4" strokeWidth={1.75} />
            </button>
          ) : null}
        </div>
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
          {categories.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setCategory(item)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium capitalize ${
                category === item ? "bg-orange-500 text-white" : "bg-[#1a1a1a] text-neutral-400"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      {featured.length > 0 ? (
        <section className="px-4 pt-4">
          <div className="mb-2.5 flex items-end justify-between">
            <p className="text-[13px] font-medium text-neutral-200">Featured</p>
            <span className="text-[10px] font-normal text-neutral-600">{featured.length}</span>
          </div>
          <div className="space-y-3">
            {featured.map((game) => (
              <GameCard key={game.id} game={game} featured />
            ))}
          </div>
        </section>
      ) : null}

      <section className="px-4 pt-4">
        <div className="mb-2.5 flex items-end justify-between">
          <p className="text-[13px] font-medium text-neutral-200">
            {query || category !== "All" ? "Results" : "All games"}
          </p>
          <span className="text-[10px] font-normal text-neutral-600">
            {regular.length + featured.length}
          </span>
        </div>
        {filtered.length === 0 ? (
          <div className="rounded-2xl bg-[#121212] px-5 py-10 text-center">
            <Gamepad2 className="mx-auto size-8 text-neutral-600" strokeWidth={1.5} />
            <p className="mt-3 text-[13px] font-medium text-neutral-400">
              {games.length === 0 ? "Games coming soon" : "No games found"}
            </p>
            <p className="mx-auto mt-1 max-w-[260px] text-[11px] font-normal text-neutral-600">
              {games.length === 0
                ? "No active games published yet."
                : "Try another title or category."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {regular.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

function GameCard({ game, featured }: { game: AvailableGame; featured?: boolean }) {
  const destination = game.embedUrl || game.launchUrl;
  const reward =
    game.rewardValue > 0
      ? game.rewardType === "usdt"
        ? "$" + game.rewardValue.toFixed(2)
        : "+" + game.rewardValue.toLocaleString() + " TP"
      : "Play to earn";
  return (
    <article className="overflow-hidden rounded-2xl bg-[#121212]">
      <div className={`relative overflow-hidden bg-[#0a0a0a] ${featured ? "aspect-[16/8]" : "aspect-[1.45/1]"}`}>
        {game.thumbnailUrl ? (
          <img
            src={game.thumbnailUrl}
            alt=""
            loading="lazy"
            className="size-full object-cover"
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <Gamepad2 className="size-10 text-neutral-600" strokeWidth={1.5} />
          </div>
        )}
        {game.featured ? (
          <span className="absolute left-2 top-2 rounded-md bg-black/50 px-2 py-0.5 text-[9px] font-medium text-orange-200 backdrop-blur">
            Featured
          </span>
        ) : null}
        <span className="absolute right-2 top-2 rounded-md bg-black/50 px-2 py-0.5 text-[9px] font-normal text-neutral-300 backdrop-blur">
          {game.category}
        </span>
      </div>
      <div className="p-3">
        <p className="truncate text-[9px] font-normal uppercase tracking-wide text-neutral-600">
          {game.providerName}
        </p>
        <h3 className="mt-0.5 truncate text-[13px] font-medium text-neutral-100">{game.title}</h3>
        {game.description ? (
          <p className="mt-1 line-clamp-2 text-[10px] font-normal leading-relaxed text-neutral-500">
            {game.description}
          </p>
        ) : null}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div>
            <p className="text-[9px] font-normal text-neutral-600">Reward</p>
            <p className="text-[11px] font-medium text-orange-400">{reward}</p>
          </div>
          {destination ? (
            <a
              href={destination}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-[10px] font-medium text-white"
              style={{ background: ACCENT_GRAD }}
            >
              <Play className="size-3 fill-current" strokeWidth={0} /> Play
            </a>
          ) : (
            <span className="rounded-xl bg-[#1a1a1a] px-3 py-2 text-[10px] font-normal text-neutral-600">
              Soon
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
