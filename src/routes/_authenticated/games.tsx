import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Gamepad2,
  Home,
  Play,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";
import { getDashboard } from "@/lib/taskora.functions";
import { getGameStats, startGameRound, completeGameRound } from "@/lib/game.functions";
import { TASKORA_LOGO, BLUE_GRAD } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/games")({
  loader: async () => {
    const [stats, dash] = await Promise.all([
      getGameStats().catch(() => null),
      getDashboard().catch(() => null),
    ]);
    return { stats, dash };
  },
  component: GamesPage,
});

function GamesPage() {
  const { stats: initialStats, dash } = Route.useLoaderData();
  const profile = dash?.profile as { display_name?: string | null; photo_url?: string | null; level_num?: number | null } | null;
  const [stats, setStats] = useState(initialStats);
  const [playing, setPlaying] = useState(false);
  const [roundId, setRoundId] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(30);
  const [score, setScore] = useState(0);
  const [bestRound, setBestRound] = useState(initialStats?.bestScore ?? 0);
  const [target, setTarget] = useState({ x: 50, y: 50 });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const dailyRemaining = stats?.dailyRemaining ?? 100;
  const canPlay = dailyRemaining > 0 && !busy;
  const progress = Math.max(0, Math.min(100, ((30 - seconds) / 30) * 100));
  const estimatedReward = useMemo(() => Math.min(20, 5 + Math.floor(score / 10)), [score]);

  function moveTarget() {
    setTarget({ x: Math.round(14 + Math.random() * 72), y: Math.round(16 + Math.random() * 66) });
  }

  async function begin() {
    if (!canPlay) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await startGameRound();
      setRoundId(result.roundId);
      setSeconds(result.roundSeconds);
      setScore(0);
      moveTarget();
      setPlaying(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not start the game.");
    } finally {
      setBusy(false);
    }
  }

  async function finishRound(finalScore: number) {
    if (!roundId) return;
    setBusy(true);
    try {
      const result = await completeGameRound({ data: { roundId, score: finalScore } });
      setStats((current) =>
        current
          ? { ...current, taskPoints: result.totalPoints, dailyPoints: result.dailyPoints, dailyRemaining: result.dailyRemaining, roundsToday: current.roundsToday + 1, bestScore: Math.max(current.bestScore, finalScore) }
          : current,
      );
      setBestRound((value) => Math.max(value, finalScore));
      setPlaying(false);
      setRoundId(null);
      setSeconds(30);
      setMessage(result.awardedPoints > 0 ? "Round verified · +" + result.awardedPoints + " Task Points" : "Round verified. Your daily game limit has been reached.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not verify this round.");
      setPlaying(false);
      setRoundId(null);
      setSeconds(30);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!playing || !roundId) return;
    timerRef.current = window.setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          if (timerRef.current) window.clearInterval(timerRef.current);
          timerRef.current = null;
          void finishRound(score);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [playing, roundId, score]);

  function hitTarget() {
    if (!playing || busy) return;
    setScore((value) => value + 1);
    moveTarget();
  }

  function abandon() {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    setPlaying(false);
    setRoundId(null);
    setSeconds(30);
    setScore(0);
    setMessage("Round cancelled. No points were awarded.");
  }

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

      {!playing ? (
        <>
          <section className="px-3.5 pt-4">
            <div className="relative overflow-hidden rounded-[28px] border border-cyan-300/20 bg-[radial-gradient(circle_at_82%_16%,rgba(34,211,238,.24),transparent_34%),radial-gradient(circle_at_10%_80%,rgba(37,99,235,.18),transparent_36%),linear-gradient(145deg,#0b1c31,#07101d)] p-5 shadow-[0_18px_55px_rgba(14,165,233,.12)]">
              <div className="absolute -right-10 -top-10 size-36 rounded-full border border-cyan-300/10" />
              <div className="absolute -right-3 top-0 size-24 rounded-full border border-cyan-300/10" />
              <div className="relative">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-cyan-200"><Sparkles className="size-3" /> Skill game</span>
                <h1 className="mt-3 text-[29px] font-black leading-[1.05] tracking-tight">Taskora<br />Tap Rush</h1>
                <p className="mt-2 max-w-[290px] text-[11px] leading-relaxed text-slate-400">Hit the moving target as many times as you can in 30 seconds. Your score is verified server-side before Task Points are credited.</p>
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <Stat label="Today" value={(stats?.dailyPoints ?? 0) + " TP"} />
                  <Stat label="Remaining" value={dailyRemaining + " TP"} />
                  <Stat label="Best" value={String(bestRound)} />
                </div>
              </div>
            </div>
          </section>

          <section className="px-3.5 pt-4">
            <div className="rounded-3xl border border-white/8 bg-[#0a1423] p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-11 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-200 ring-1 ring-cyan-300/15"><Target className="size-5" /></div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black">How it works</p>
                  <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">30 seconds · skill-based · up to 20 TP per verified round · 100 TP daily cap</p>
                </div>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center"><MiniStep number="01" text="Start" /><MiniStep number="02" text="Tap" /><MiniStep number="03" text="Claim" /></div>
            </div>

            {message ? <div className="mt-3 flex items-center gap-2 rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.08] px-3 py-2.5 text-[11px] text-cyan-100"><CheckCircle2 className="size-4 shrink-0" /><span className="flex-1">{message}</span></div> : null}

            <button type="button" onClick={() => void begin()} disabled={!canPlay} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-sm font-black text-white shadow-[0_12px_35px_rgba(37,99,235,.25)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40" style={{ background: BLUE_GRAD }}>
              {busy ? "Starting…" : <><Play className="size-5 fill-current" /> Play 30 seconds</>}
            </button>

            {!canPlay && dailyRemaining <= 0 ? <p className="mt-2 text-center text-[10px] font-semibold text-amber-200/80">You have reached today’s game Task Point limit. Come back tomorrow.</p> : null}
          </section>

          <section className="px-3.5 pt-4">
            <div className="mb-2"><h2 className="flex items-center gap-1.5 text-sm font-black"><Trophy className="size-4 text-amber-300" /> Game rules</h2><p className="text-[10px] text-slate-500">Built to keep rewards tied to real play.</p></div>
            <div className="space-y-2">
              <Rule title="Server-verified" body="The completed round is checked against its real session time." />
              <Rule title="No instant claims" body="Leaving early or submitting an invalid score earns nothing." />
              <Rule title="Daily limit" body="Game rewards are capped at 100 Task Points per day." />
            </div>
          </section>
        </>
      ) : (
        <section className="px-3.5 pt-4">
          <div className="overflow-hidden rounded-[28px] border border-cyan-300/20 bg-[#07111f] shadow-[0_18px_55px_rgba(14,165,233,.12)]">
            <div className="flex items-center justify-between border-b border-white/[0.07] px-4 py-3">
              <div><p className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300">Tap Rush</p><p className="text-lg font-black">{score} hits</p></div>
              <div className="text-right"><p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Time</p><p className="text-2xl font-black tabular-nums">{seconds}s</p></div>
            </div>
            <div className="relative h-[min(78vw,390px)] min-h-[320px] overflow-hidden bg-[radial-gradient(circle_at_50%_45%,rgba(34,211,238,.09),transparent_48%),linear-gradient(180deg,#06101d,#030814)]">
              <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] [background-size:32px_32px]" />
              <button type="button" onClick={hitTarget} aria-label="Tap target" className="absolute flex size-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-cyan-100/80 bg-cyan-400 text-[#03111a] shadow-[0_0_45px_rgba(34,211,238,.65)] transition-transform active:scale-90" style={{ left: target.x + "%", top: target.y + "%" }}><Target className="size-9" /></button>
              <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5 text-[9px] font-bold text-slate-400 backdrop-blur">Tap the target</div>
            </div>
            <div className="border-t border-white/[0.07] p-4">
              <div className="mb-3 flex items-center justify-between text-[10px] font-bold"><span className="text-slate-500">Round progress</span><span className="text-cyan-200">{Math.round(progress)}%</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all" style={{ width: progress + "%" }} /></div>
              <div className="mt-3 flex items-center justify-between"><div><p className="text-[9px] uppercase tracking-wider text-slate-500">Estimated</p><p className="text-base font-black text-cyan-200">+{estimatedReward} TP</p></div><button type="button" onClick={abandon} disabled={busy} className="rounded-full border border-white/10 px-3 py-2 text-[10px] font-black text-slate-400 disabled:opacity-40">Leave round</button></div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-2xl border border-amber-300/15 bg-amber-300/[0.05] px-3 py-2.5 text-[10px] text-amber-100/80"><Zap className="size-4 shrink-0" /> Your score is capped by the verified play time. Keep playing until the timer ends.</div>
        </section>
      )}

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

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/8 bg-white/[0.035] px-2.5 py-2"><p className="text-[8px] font-bold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 truncate text-sm font-black text-white">{value}</p></div>;
}

function MiniStep({ number, text }: { number: string; text: string }) {
  return <div className="rounded-2xl border border-white/8 bg-white/[0.025] px-2 py-2"><p className="text-[9px] font-black text-cyan-300">{number}</p><p className="mt-0.5 text-[10px] font-bold text-slate-300">{text}</p></div>;
}

function Rule({ title, body }: { title: string; body: string }) {
  return <div className="flex items-start gap-3 rounded-2xl border border-white/8 bg-[#0a1423] p-3"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-cyan-300" /><div><p className="text-[11px] font-black">{title}</p><p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">{body}</p></div></div>;
}

function BottomNav({ to, icon: Icon, label, active }: { to: string; icon: typeof Home; label: string; active?: boolean }) {
  return <Link to={to} className={"flex min-w-[58px] flex-col items-center gap-1 rounded-xl px-2 py-1.5 text-[9px] font-bold " + (active ? "text-cyan-200" : "text-slate-500")}><Icon className="size-4" />{label}</Link>;
}
