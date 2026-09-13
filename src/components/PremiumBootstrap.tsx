import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { loginWithTelegram } from "@/lib/taskora.functions";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: {
          user?: { id?: number; first_name?: string; username?: string };
        };
        ready?: () => void;
        expand?: () => void;
        setHeaderColor?: (color: string) => void;
        setBackgroundColor?: (color: string) => void;
      };
    };
  }
}

/** Official TASKORA logo (keep existing loader visual). */
const LOGO = "/file_00000000f8ec8246a98cce68ff972640.png";

/** 10-stage account initialization — slow enough to read (~7–10s total when ready). */
const STAGES: { title: string; detail: string; until: number }[] = [
  { title: "SECURE CONNECTION", detail: "Establishing secure connection...", until: 10 },
  { title: "ACCOUNT AUTHENTICATION", detail: "Authenticating your account...", until: 20 },
  { title: "SESSION INITIALIZATION", detail: "Initializing secure session...", until: 30 },
  { title: "PROFILE SYNCHRONIZATION", detail: "Synchronizing your profile...", until: 40 },
  { title: "ACCOUNT VERIFICATION", detail: "Verifying account status...", until: 50 },
  { title: "PLATFORM SYNCHRONIZATION", detail: "Syncing connected platforms...", until: 60 },
  { title: "WALLET INITIALIZATION", detail: "Initializing wallet...", until: 70 },
  { title: "TASK SYNCHRONIZATION", detail: "Synchronizing your available tasks...", until: 80 },
  { title: "WORKSPACE INITIALIZATION", detail: "Preparing your TASKORA workspace...", until: 90 },
  { title: "FINAL ACCOUNT INITIALIZATION", detail: "Finalizing your secure TASKORA session...", until: 100 },
];

function stageForProgress(p: number) {
  return STAGES.find((s) => p <= s.until) ?? STAGES[STAGES.length - 1]!;
}

export function PremiumBootstrap({ redirectTo = "/home" }: { redirectTo?: string }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState(STAGES[0]!);
  const [phase, setPhase] = useState<"loading" | "welcome" | "error" | "need-telegram">("loading");
  const [error, setError] = useState<string | null>(null);
  const [welcomeName, setWelcomeName] = useState("Tasker");
  const [goOwner, setGoOwner] = useState(false);
  const started = useRef(false);
  const authDone = useRef(false);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    try {
      tg?.ready?.();
      tg?.expand?.();
      tg?.setHeaderColor?.("#0a0c12");
      tg?.setBackgroundColor?.("#0a0c12");
    } catch {
      /* ignore */
    }

    const user = tg?.initDataUnsafe?.user;
    if (user?.first_name) setWelcomeName(user.first_name);

    // Smooth progress over ~8s to 92%, then hold until auth finishes + final stage hold
    const tick = window.setInterval(() => {
      setProgress((p) => {
        if (authDone.current) {
          const next = Math.min(100, p + 1.2);
          setStage(stageForProgress(next));
          return next;
        }
        if (p >= 92) return p;
        // ~8 seconds to 92%: 9200ms / 180ms ≈ 51 ticks → ~1.8% per tick
        const next = Math.min(92, p + 1.75);
        setStage(stageForProgress(next));
        return next;
      });
    }, 180);

    async function boot() {
      if (started.current) return;
      started.current = true;

      const initData = tg?.initData ?? "";
      if (!initData) {
        window.clearInterval(tick);
        setPhase("need-telegram");
        setError("Open TASKORA from @Taskoraplusbot inside Telegram.");
        return;
      }

      try {
        // ALWAYS re-auth with current Telegram identity — never reuse another account session
        await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);

        const result = await loginWithTelegram({ data: { initData } });
        const { error: sessErr } = await supabase.auth.setSession({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
        });
        if (sessErr) throw sessErr;

        const { data: confirmed, error: userErr } = await supabase.auth.getUser();
        if (userErr || !confirmed.user) {
          throw userErr ?? new Error("Session could not be confirmed.");
        }

        // Ensure session telegram_id matches initData user (wrong-account guard)
        const sessionTg = Number(confirmed.user.user_metadata?.telegram_id ?? 0);
        if (sessionTg && sessionTg !== result.telegramId) {
          await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
          throw new Error("Session identity mismatch. Please Retry.");
        }

        if (result.firstName) setWelcomeName(result.firstName);
        setGoOwner(Boolean(result.isOwner));
        authDone.current = true;

        // Wait until progress reaches 100 and final stage has been visible ~1.5–2s
        await new Promise<void>((resolve) => {
          const check = window.setInterval(() => {
            setProgress((p) => {
              if (p >= 100) {
                window.clearInterval(check);
                window.setTimeout(resolve, 1800);
              }
              return Math.min(100, Math.max(p, 93) + 2);
            });
          }, 120);
        });

        window.clearInterval(tick);
        setProgress(100);
        setStage(STAGES[9]!);
        setPhase("welcome");

        window.setTimeout(() => {
          navigate({ to: result.isOwner ? "/owner" : redirectTo, replace: true });
        }, 900);
      } catch (e) {
        window.clearInterval(tick);
        setPhase("error");
        const msg = e instanceof Error ? e.message : "TASKORA could not authenticate with Telegram.";
        setError(
          msg.includes("kid") || msg.includes("JWT") || msg.includes("ES256")
            ? "Session keys out of sync. Confirm Vercel Supabase keys match project qvwetjpgplkhxuymsnyx, then Retry."
            : msg,
        );
        setProgress(0);
        setStage(STAGES[0]!);
      }
    }

    const t = window.setTimeout(() => {
      void boot();
    }, 200);

    return () => {
      window.clearInterval(tick);
      window.clearTimeout(t);
    };
  }, [navigate, redirectTo]);

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center overflow-hidden bg-[#0a0c12] px-6 text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 28%, rgba(245,197,66,0.16), transparent 52%), radial-gradient(ellipse at 50% 90%, rgba(245,197,66,0.05), transparent 45%)",
        }}
      />

      <div className="relative z-10 flex w-full flex-col items-center">
        <div className="relative mb-5">
          <div className="absolute -inset-4 rounded-full bg-amber-400/15 blur-xl" />
          <img
            src={LOGO}
            alt="TASKORA"
            className="relative size-36 rounded-full object-cover shadow-[0_0_40px_rgba(245,197,66,0.35)]"
          />
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-200/60">TASKORA</p>
        <h1 className="mt-2 text-center text-2xl font-bold tracking-tight text-white">
          {phase === "welcome"
            ? `Welcome, ${welcomeName}${goOwner ? " · Owner" : ""}`
            : "Verified Tasks. Real Rewards."}
        </h1>
        <p className="mt-1 text-center text-xs text-white/40">@Taskoraplusbot</p>

        {phase === "loading" || phase === "welcome" ? (
          <div className="mt-10 w-full max-w-xs">
            <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300/90">
              {stage.title}
            </p>
            <p className="mt-1.5 text-center text-xs text-white/55">{stage.detail}</p>
            <div className="mt-4 mb-2 flex items-center justify-between text-[11px] text-white/45">
              <span>Account initialization</span>
              <span className="font-semibold tabular-nums text-amber-300">{Math.floor(progress)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-[width] duration-200 ease-out"
                style={{
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, #C9961A, #F5C542, #FFE08A)",
                }}
              />
            </div>
            {phase === "welcome" ? (
              <p className="mt-4 text-center text-sm text-white/65">
                {goOwner ? "Opening Owner Control…" : "Opening your dashboard…"}
              </p>
            ) : null}
          </div>
        ) : null}

        {phase === "need-telegram" || phase === "error" ? (
          <div className="mt-8 w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-5 text-center backdrop-blur">
            <p className="text-sm text-white/80">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 w-full rounded-2xl px-4 py-3 text-sm font-bold text-[#0a0c12]"
              style={{ background: "linear-gradient(135deg, #FFE08A, #F5C542, #C9961A)" }}
            >
              Retry
            </button>
            <p className="mt-3 text-[11px] text-white/40">Telegram → @Taskoraplusbot → Open TASKORA</p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
