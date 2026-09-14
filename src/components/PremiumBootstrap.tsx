import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { loginWithTelegram } from "@/lib/taskora.functions";
import { supabase } from "@/integrations/supabase/client";
import { TASKORA_LOGO } from "@/lib/brand";

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

const LOGO = TASKORA_LOGO;

/** 10 stages — each must be readable; total ~8–10s even when auth is fast */
const STAGES: { title: string; detail: string }[] = [
  { title: "SECURE CONNECTION", detail: "Establishing secure connection..." },
  { title: "ACCOUNT AUTHENTICATION", detail: "Authenticating your account..." },
  { title: "SESSION INITIALIZATION", detail: "Initializing secure session..." },
  { title: "PROFILE SYNCHRONIZATION", detail: "Synchronizing your profile..." },
  { title: "ACCOUNT VERIFICATION", detail: "Verifying account status..." },
  { title: "PLATFORM SYNCHRONIZATION", detail: "Syncing connected platforms..." },
  { title: "WALLET INITIALIZATION", detail: "Initializing wallet..." },
  { title: "TASK SYNCHRONIZATION", detail: "Synchronizing your available tasks..." },
  { title: "WORKSPACE INITIALIZATION", detail: "Preparing your TASKORA workspace..." },
  { title: "FINAL ACCOUNT INITIALIZATION", detail: "Finalizing your secure TASKORA session..." },
];

/** ms visible per stage (stage 10 held longer after auth) */
const STAGE_MS = 850;
const FINAL_HOLD_MS = 2000;
const WELCOME_MS = 1100;

export function PremiumBootstrap({ redirectTo = "/home" }: { redirectTo?: string }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const [phase, setPhase] = useState<"loading" | "welcome" | "error" | "need-telegram">("loading");
  const [error, setError] = useState<string | null>(null);
  const [welcomeName, setWelcomeName] = useState("Tasker");
  const [isOwner, setIsOwner] = useState(false);
  const started = useRef(false);
  const authPromise = useRef<Promise<void> | null>(null);
  const authResult = useRef<{ ok: boolean; firstName?: string; isOwner?: boolean; error?: string }>({
    ok: false,
  });

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    try {
      // Show our custom loader first; ready() removes Telegram's native spinner
      tg?.ready?.();
      tg?.expand?.();
      tg?.setHeaderColor?.("#05070c");
      tg?.setBackgroundColor?.("#05070c");
    } catch {
      /* ignore */
    }

    const user = tg?.initDataUnsafe?.user;
    if (user?.first_name) setWelcomeName(user.first_name);

    async function runAuth() {
      const initData = tg?.initData ?? "";
      if (!initData) {
        authResult.current = {
          ok: false,
          error: "Open TASKORA from @Taskoraplusbot inside Telegram.",
        };
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

        const { data: confirmed, error: userErr } = await supabase.auth.getUser();
        if (userErr || !confirmed.user) {
          throw userErr ?? new Error("Session could not be confirmed.");
        }

        const sessionTg = Number(confirmed.user.user_metadata?.telegram_id ?? 0);
        if (sessionTg && sessionTg !== result.telegramId) {
          await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
          throw new Error("Session identity mismatch. Please Retry.");
        }

        authResult.current = {
          ok: true,
          firstName: result.firstName,
          isOwner: Boolean(result.isOwner),
        };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "TASKORA could not authenticate with Telegram.";
        authResult.current = {
          ok: false,
          error:
            msg.includes("kid") || msg.includes("JWT") || msg.includes("ES256")
              ? "Session keys out of sync. Confirm Vercel Supabase keys, then Retry."
              : msg,
        };
      }
    }

    async function sequence() {
      if (started.current) return;
      started.current = true;

      // Auth runs in parallel with stage animation — UI never jumps early
      authPromise.current = runAuth();

      for (let i = 0; i < STAGES.length; i++) {
        setStageIndex(i);
        const startPct = (i / STAGES.length) * 100;
        const endPct = ((i + 1) / STAGES.length) * 100;
        setProgress(startPct);

        const hold = i === STAGES.length - 1 ? FINAL_HOLD_MS : STAGE_MS;
        const steps = Math.max(8, Math.floor(hold / 80));
        for (let s = 1; s <= steps; s++) {
          await new Promise((r) => window.setTimeout(r, hold / steps));
          setProgress(startPct + ((endPct - startPct) * s) / steps);
        }
      }

      setProgress(100);
      setStageIndex(STAGES.length - 1);

      // Ensure auth finished before leaving loader
      await authPromise.current;

      if (!authResult.current.ok) {
        if (!tg?.initData) {
          setPhase("need-telegram");
        } else {
          setPhase("error");
        }
        setError(authResult.current.error ?? "Authentication failed.");
        return;
      }

      if (authResult.current.firstName) setWelcomeName(authResult.current.firstName);
      setIsOwner(Boolean(authResult.current.isOwner));
      setPhase("welcome");

      // Always open the main app (Home). Owner opens Control Center from Profile / menu.
      window.setTimeout(() => {
        navigate({ to: redirectTo, replace: true });
      }, WELCOME_MS);
    }

    void sequence();
  }, [navigate, redirectTo]);

  const stage = STAGES[stageIndex]!;

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center overflow-hidden bg-[#05070c] px-6 text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 28%, rgba(245,197,66,0.18), transparent 52%), radial-gradient(ellipse at 50% 95%, rgba(245,197,66,0.06), transparent 45%)",
        }}
      />

      <div className="relative z-10 flex w-full flex-col items-center">
        <div className="relative mb-5">
          <div className="absolute -inset-5 rounded-full bg-amber-400/20 blur-2xl" />
          <img
            src={LOGO}
            alt="TASKORA"
            className="relative size-40 rounded-full object-cover shadow-[0_0_48px_rgba(245,197,66,0.4)] ring-2 ring-amber-400/30"
          />
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-200/65">TASKORA</p>
        <h1 className="mt-2 text-center text-2xl font-bold tracking-tight text-white">
          {phase === "welcome"
            ? `Welcome, ${welcomeName}`
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
              <span>
                Step {stageIndex + 1} of {STAGES.length}
              </span>
              <span className="font-semibold tabular-nums text-amber-300">{Math.floor(progress)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-[width] duration-150 ease-out"
                style={{
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, #C9961A, #F5C542, #FFE08A)",
                }}
              />
            </div>
            {phase === "welcome" ? (
              <p className="mt-4 text-center text-sm text-white/65">
                {isOwner ? "Opening TASKORA…" : "Opening your dashboard…"}
              </p>
            ) : (
              <p className="mt-3 text-center text-[10px] text-white/30">Please wait — finishing setup</p>
            )}
          </div>
        ) : null}

        {phase === "need-telegram" || phase === "error" ? (
          <div className="mt-8 w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-5 text-center backdrop-blur">
            <p className="text-sm text-white/80">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 w-full rounded-2xl px-4 py-3 text-sm font-bold text-[#05070c]"
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
