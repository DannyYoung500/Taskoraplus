import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronRight,
  Gamepad2,
  Home,
  Play,
  Search,
  Sparkles,
  Target,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { getDashboard } from "@/lib/taskora.functions";
import { getAvailableGames, type AvailableGame } from "@/lib/game.functions";
import { TASKORA_LOGO, BLUE_GRAD } from "@/lib/brand";

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
      const haystack = [game.title, game.providerName, game.category, game.description ?? ""].join(" ").toLowerCase();
      return matchesCategory && (!q || haystack.includes(q));
    });
  }, [games, query, category]);

  const featured = filtered.filter((game) => game.featured);
  const regular = filtered.filter((game) => !game.featured);
  const profile = dash?.profile as { task_points?: number | null } | null;
  const points = Number(profile?.task_points ?? 0);

  return (
    <main className="mx-auto min-h-screen w-full max-w-md overflow-x-hidden bg-[#030814] pb-28 text-white">
      <header className="sticky top-0 z-30 border-b border-white/[0.07] bg-[#030814]/95 px-3.5 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <Link to="/home" aria-label="Back to home" className="rounded-full p-2 text-slate-300"><ArrowLeft className="size-5" /></Link>
          <img src={TASKORA_LOGO} alt="TASKORA" className="size-9 rounded-full ring-1 ring-cyan-400/40" />
          <div className="min-w-0 flex-1">
            <p className="text-base font-black tracking-wide">GAMES</p>
            <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-cyan-300/65">Play · Earn · Grow</p>
          </div>
          <Link to="/wallet" aria-label="Wallet" className="rounded-full border border-white/10 bg-white/[0.04] p-2 text-cyan-200"><WalletCards className="size-4" /></Link>
        </div>
      </header>

      <section className="px-3.5 pt-4">
        <div className="relative overflow-hidden rounded-[28px] border border-cyan-300/20 bg-[radial-gradient(circle_at_85%_10%,rgba(34,211,238,.22),transparent_34%),radial-gradient(circle_at_10%_100%,rgba(37,99,235,.2),transparent_38%),linear-gradient(145deg,#0b1c31,#07101d)] p-5 shadow-[0_18px_55px_rgba(14,165,233,.1)]">
          <div className="absolute -right-10 -top-12 size-40 rounded-full border border-cyan-300/10" />
          <div className="absolute -right-2 top-8 size-24 rounded-full border border-cyan-300/10" />
          <div className="relative">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-cyan-200"><Sparkles className="size-3" /> Games marketplace</span>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <h1 className="text-[29px] font-black leading-[1.05] tracking-tight">Play games.<br />Earn rewards.</h1>
                <p className="mt-2 max-w-[280px] text-[11px] leading-relaxed text-slate-400">Play games from TASKORA's configured providers. Rewards are shown from the game's live owner configuration.</p>
              </div>
              <div className="hidden size-16 shrink-0 items-center justify-center rounded-3xl border border-cyan-300/15 bg-cyan-300/10 sm:flex"><Gamepad2 className="size-8 text-cyan-200" /></div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/8 bg-black/15 px-3 py-2.5">
              <div><p className="text-[8px] font-bold uppercase tracking-wider text-slate-500">Your Task Points</p><p className="mt-0.5 text-lg font-black">{points.toLocaleString()}</p></div>
              <Link to="/wallet" className="flex items-center gap-1 rounded-xl bg-white/[0.07] px-3 py-2 text-[10px] font-black text-cyan-200">Wallet <ChevronRight className="size-3" /></Link>
            </div>
          </div>
        </div>
      </section>

      <section className="px-3.5 pt-4">
        <div className="flex items-center gap-2 rounded-2xl border border-white/8 bg-[#0a1423] px-3">
          <Search className="size-4 text-slate-500" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search games or providers" className="min-w-0 flex-1 bg-transparent py-3 text-xs text-white outline-none placeholder:text-slate-600" />
          {query ? <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="text-slate-500"><X className="size-4" /></button> : null}
        </div>
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {categories.map((item) => (
            <button key={item} type="button" onClick={() => setCategory(item)} className={"shrink-0 rounded-full border px-3 py-2 text-[9px] font-black capitalize " + (category === item ? "border-cyan-300/40 bg-cyan-300/10 text-cyan-100" : "border-white/10 bg-[#0a1423] text-slate-500")}>{item}</button>
          ))}
        </div>
      </section>

      {featured.length > 0 ? (
        <section className="px-3.5 pt-4">
          <div className="mb-2 flex items-end justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300">Featured</p><h2 className="text-lg font-black">Featured games</h2></div><span className="text-[9px] font-bold text-slate-600">{featured.length} games</span></div>
          <div className="space-y-3">{featured.map((game) => <GameCard key={game.id} game={game} featured />)}</div>
        </section>
      ) : null}

      <section className="px-3.5 pt-4">
        <div className="mb-2 flex items-end justify-between"><div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">Catalogue</p><h2 className="text-lg font-black">{query || category !== "All" ? "Search results" : "All games"}</h2></div><span className="text-[9px] font-bold text-slate-600">{regular.length + featured.length} games</span></div>
        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-white/8 bg-[#0a1423] px-5 py-10 text-center">
            <Gamepad2 className="mx-auto size-9 text-slate-700" />
            <p className="mt-3 text-sm font-black">{games.length === 0 ? "Games are coming soon" : "No games found"}</p>
            <p className="mx-auto mt-1 max-w-[270px] text-[10px] leading-relaxed text-slate-500">{games.length === 0 ? "No active games have been published by the owner yet. Check back when a provider game is activated." : "Try another game title, provider or category."}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">{regular.map((game) => <GameCard key={game.id} game={game} />)}</div>
        )}
      </section>

      <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-md items-center justify-around border-t border-white/[0.08] bg-[#030814]/95 px-2 py-2.5 backdrop-blur-xl">
        <BottomNav to="/home" icon={Home} label="Home" />
        <BottomNav to="/watch-earn" icon={Play} label="Watch" />
        <BottomNav to="/games" icon={Gamepad2} label="Games" active />
        <BottomNav to="/tasks" icon={Target} label="Tasks" />
        <BottomNav to="/ambassador" icon={Users} label="Refer" />
      </nav>
    </main>
  );
}

function GameCard({ game, featured }: { game: AvailableGame; featured?: boolean }) {
  const destination = game.embedUrl || game.launchUrl;
  const reward = game.rewardValue > 0 ? (game.rewardType === "usdt" ? "$" + game.rewardValue.toFixed(2) : "+" + game.rewardValue.toLocaleString() + " TP") : "Play to earn";
  return (
    <article className={"overflow-hidden rounded-3xl border border-white/8 bg-[#0a1423] " + (featured ? "shadow-[0_18px_50px_rgba(14,165,233,.08)]" : "")}>
      <div className={"relative overflow-hidden bg-[#07111f] " + (featured ? "aspect-[16/8]" : "aspect-[1.45/1]")}>
        {game.thumbnailUrl ? <img src={game.thumbnailUrl} alt="" loading="lazy" className="size-full object-cover transition-transform duration-300 hover:scale-[1.03]" /> : <div className="flex size-full items-center justify-center bg-[radial-gradient(circle_at_50%_35%,rgba(34,211,238,.14),transparent_55%)]"><Gamepad2 className="size-12 text-cyan-300/50" /></div>}
        {game.featured ? <span className="absolute left-2 top-2 rounded-full border border-white/10 bg-black/45 px-2 py-1 text-[8px] font-black uppercase tracking-wider text-cyan-100 backdrop-blur">Featured</span> : null}
        <span className="absolute right-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[8px] font-bold text-white/75 backdrop-blur">{game.category}</span>
      </div>
      <div className="p-3">
        <p className="truncate text-[9px] font-bold uppercase tracking-wider text-slate-600">{game.providerName}</p>
        <h3 className="mt-1 truncate text-sm font-black">{game.title}</h3>
        {game.description ? <p className="mt-1 line-clamp-2 text-[9px] leading-relaxed text-slate-500">{game.description}</p> : null}
        <div className="mt-3 flex items-center justify-between gap-2">
          <div><p className="text-[8px] uppercase tracking-wider text-slate-600">Reward</p><p className="text-[10px] font-black text-cyan-200">{reward}</p></div>
          {destination ? <a href={destination} target="_blank" rel="noopener noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[9px] font-black text-white shadow-lg" style={{ background: BLUE_GRAD }}><Play className="size-3 fill-current" /> Play</a> : <span className="rounded-xl border border-white/10 px-3 py-2 text-[9px] font-bold text-slate-600">Unavailable</span>}
        </div>
        {game.estimatedMinutes ? <p className="mt-2 text-[8px] text-slate-600">Estimated play time · {game.estimatedMinutes} min</p> : null}
      </div>
    </article>
  );
}

function BottomNav({ to, icon: Icon, label, active }: { to: string; icon: typeof Home; label: string; active?: boolean }) {
  return <Link to={to} className={"flex min-w-[58px] flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[9px] font-bold " + (active ? "text-cyan-200" : "text-slate-500")}><Icon className="size-4" />{label}</Link>;
}
