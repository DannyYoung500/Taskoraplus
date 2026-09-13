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

const STEPS: { at: number; label: string }[] = [
  { at: 0, label: "Opening TASKORA…" },
  { at: 12, label: "Connecting securely…" },
  { at: 28, label: "Validating Telegram session…" },
  { at: 48, label: "Connecting to dashboard…" },
  { at: 68, label: "Preparing your home…" },
  { at: 85, label: "Almost ready…" },
  { at: 96, label: "Welcome" },
];

/** Premium entry: TASKORA brand logo only (never user avatar). Auto-auth, no Continue button. */
export function PremiumBootstrap({ redirectTo = "/home" }: { redirectTo?: string }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [label, setLabel] = useState(STEPS[0]!.label);
  const [phase, setPhase] = useState<"loading" | "welcome" | "error" | "need-telegram">("loading");
  const [error, setError] = useState<string | null>(null);
  const [welcomeName, setWelcomeName] = useState("Tasker");
  const started = useRef(false);

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

    const tick = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 92) return p;
        const next = Math.min(92, p + Math.random() * 4 + 1.5);
        const step = [...STEPS].reverse().find((s) => next >= s.at);
        if (step) setLabel(step.label);
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
        await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
        const result = await loginWithTelegram({ data: { initData } });
        const { error: sessErr } = await supabase.auth.setSession({
          access_token: result.access_token,
          refresh_token: result.refresh_token,
        });
        if (sessErr) throw sessErr;

        if (result.firstName) setWelcomeName(result.firstName);
        window.clearInterval(tick);
        setProgress(100);
        setLabel("Welcome");
        setPhase("welcome");

        window.setTimeout(() => {
          navigate({ to: redirectTo, replace: true });
        }, 1500);
      } catch (e) {
        window.clearInterval(tick);
        setPhase("error");
        setError(
          e instanceof Error ? e.message : "TASKORA could not authenticate with Telegram.",
        );
        setProgress(0);
        setLabel("Authentication failed");
      }
    }

    const t = window.setTimeout(() => {
      void boot();
    }, 120);

    return () => {
      window.clearInterval(tick);
      window.clearTimeout(t);
    };
  }, [navigate, redirectTo]);

  function retry() {
    window.location.reload();
  }

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
        {/* Official TASKORA logo only — never user photo */}
        <div className="relative mb-5">
          <div className="absolute -inset-4 rounded-full bg-amber-400/15 blur-xl" />
          <img
            src="/taskora-logo.svg"
            alt="TASKORA"
            className="relative size-32 object-contain drop-shadow-[0_0_24px_rgba(245,197,66,0.35)]"
          />
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-amber-200/60">
          TASKORA
        </p>
        <h1 className="mt-2 text-center text-2xl font-bold tracking-tight text-white">
          {phase === "welcome" ? `Welcome, ${welcomeName}` : "Verified Tasks. Real Rewards."}
        </h1>
        <p className="mt-1 text-center text-xs text-white/40">@Taskoraplusbot</p>

        {phase === "loading" || phase === "welcome" ? (
          <div className="mt-10 w-full max-w-xs">
            <div className="mb-2 flex items-center justify-between text-[11px] text-white/55">
              <span>{label}</span>
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
              <p className="mt-4 text-center text-sm text-white/65">Opening your dashboard…</p>
            ) : null}
          </div>
        ) : null}

        {phase === "need-telegram" || phase === "error" ? (
          <div className="mt-8 w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-5 text-center backdrop-blur">
            <p className="text-sm text-white/80">
              {error ?? "TASKORA could not authenticate with Telegram."}
            </p>
            <button
              type="button"
              onClick={retry}
              className="mt-4 w-full rounded-2xl px-4 py-3 text-sm font-bold text-[#0a0c12]"
              style={{ background: "linear-gradient(135deg, #FFE08A, #F5C542, #C9961A)" }}
            >
              Retry
            </button>
            <p className="mt-3 text-[11px] text-white/40">
              Telegram → @Taskoraplusbot → Open TASKORA
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
