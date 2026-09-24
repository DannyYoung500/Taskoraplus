import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { loginWithTelegram } from "@/lib/taskora.functions";
import { getAccountAccess, getMaintenanceMode } from "@/lib/account-access.functions";
import { supabase } from "@/integrations/supabase/client";
import { TASKORA_LOGO, TASKORA_WELCOME_IMAGE, BLUE_GRAD } from "@/lib/brand";

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
        HapticFeedback?: {
          impactOccurred?: (s: string) => void;
          notificationOccurred?: (t: string) => void;
        };
      };
    };
  }
}

/**
 * Enterprise premium boot screen — Telegram Mini App best practices:
 * 1. WebApp.ready() + expand() on first paint (kills Telegram system loader)
 * 2. Theme header/bg match app (#030814)
 * 3. Short staged progress (no white flash, no long spinner)
 * 4. Dual-ring logo + ambient orbs + shimmer bar (premium feel)
 * 5. Soft-fail auth + maintenance / ban / suspend redirects
 */
const STAGES = [
  { title: "Connecting", detail: "Secure Telegram session" },
  { title: "Signing in", detail: "Verifying your account" },
  { title: "Almost ready", detail: "Opening TASKORA" },
] as const;

const STAGE_MS = 240;
const WELCOME_MS = 520;
const MIN_TOTAL_MS = 980;

export function PremiumBootstrap({ redirectTo = "/home" }: { redirectTo?: string }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(6);
  const [stageIndex, setStageIndex] = useState(0);
  const [phase, setPhase] = useState<"loading" | "welcome" | "error" | "need-telegram">("loading");
  const [error, setError] = useState<string | null>(null);
  const [welcomeName, setWelcomeName] = useState("Tasker");
  const [goOwner, setGoOwner] = useState(false);
  const [logoSrc, setLogoSrc] = useState(TASKORA_LOGO);
  const started = useRef(false);
  const authPromise = useRef<Promise<void> | null>(null);
  const authResult = useRef<{
    ok: boolean;
    firstName?: string;
    isOwner?: boolean;
    error?: string;
  }>({ ok: false });

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    // Critical: ready() first so Telegram drops its system loader immediately
    try {
      tg?.ready?.();
      tg?.expand?.();
      tg?.setHeaderColor?.("#030814");
      tg?.setBackgroundColor?.("#030814");
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
        // Always bind the Supabase session to the Telegram user that launched this Mini App.
        // A cached browser session can belong to a different Telegram account and trigger
        // a false "Telegram account not linked" gate error.
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

        // Soft identity check — tokens already work; do not force Retry
        const sessionTg = Number(confirmed.user.user_metadata?.telegram_id ?? 0);
        if (sessionTg && result.telegramId && sessionTg !== result.telegramId) {
          console.warn("[TASKORA] telegram_id metadata differs; continuing with valid session");
        }

        authResult.current = {
          ok: true,
          firstName: result.firstName ?? undefined,
          isOwner: Boolean(result.isOwner),
        };
        try {
          window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
        } catch {
          /* ignore */
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : "TASKORA could not authenticate with Telegram.";
        // One automatic retry for transient failures
        try {
          await new Promise((r) => window.setTimeout(r, 400));
          const result2 = await loginWithTelegram({ data: { initData } });
          const { error: sessErr2 } = await supabase.auth.setSession({
            access_token: result2.access_token,
            refresh_token: result2.refresh_token,
          });
          if (sessErr2) throw sessErr2;
          authResult.current = {
            ok: true,
            firstName: result2.firstName ?? undefined,
            isOwner: Boolean(result2.isOwner),
          };
          return;
        } catch {
          /* fall through */
        }
        authResult.current = {
          ok: false,
          error:
            msg.includes("kid") || msg.includes("JWT") || msg.includes("ES256")
              ? "Open TASKORA again from @Taskoraplusbot (session refresh needed)."
              : msg.includes("initData") || msg.includes("Telegram")
                ? "Open TASKORA from @Taskoraplusbot inside Telegram."
                : msg,
        };
      }
    }

    async function sequence() {
      if (started.current) return;
      started.current = true;
      const t0 = Date.now();
      authPromise.current = runAuth();

      for (let i = 0; i < STAGES.length; i++) {
        setStageIndex(i);
        const startPct = 6 + (i / STAGES.length) * 88;
        const endPct = 6 + ((i + 1) / STAGES.length) * 88;
        setProgress(startPct);
        const hold = STAGE_MS;
        const steps = Math.max(2, Math.floor(hold / 36));
        for (let s = 1; s <= steps; s++) {
          await new Promise((r) => window.setTimeout(r, hold / steps));
          setProgress(startPct + ((endPct - startPct) * s) / steps);
          if (authResult.current.ok && i >= 1) break;
        }
        if (authResult.current.ok && i >= 1) {
          setStageIndex(STAGES.length - 1);
          setProgress(100);
          break;
        }
      }

      setProgress(100);
      setStageIndex(STAGES.length - 1);
      await authPromise.current;

      const elapsed = Date.now() - t0;
      if (elapsed < MIN_TOTAL_MS) {
        await new Promise((r) => window.setTimeout(r, MIN_TOTAL_MS - elapsed));
      }

      if (!authResult.current.ok) {
        setPhase(!tg?.initData ? "need-telegram" : "error");
        setError(authResult.current.error ?? "Authentication failed.");
        return;
      }

      if (authResult.current.firstName) setWelcomeName(authResult.current.firstName);
      setGoOwner(Boolean(authResult.current.isOwner));

      try {
        const maint = await getMaintenanceMode();
        if (maint.enabled && !authResult.current.isOwner) {
          navigate({ to: "/maintenance", replace: true });
          return;
        }
        const access = await getAccountAccess();
        if (access.state === "banned") {
          navigate({ to: "/banned", replace: true });
          return;
        }
        if (access.state === "suspended") {
          navigate({ to: "/suspended", replace: true });
          return;
        }
        if (access.state === "maintenance") {
          navigate({ to: "/maintenance", replace: true });
          return;
        }
      } catch {
        /* soft-fail */
      }

      setPhase("welcome");
      window.setTimeout(() => {
        navigate({ to: redirectTo as "/home", replace: true });
      }, WELCOME_MS);
    }

    void sequence();
  }, [navigate, redirectTo]);

  const stage = STAGES[stageIndex]!;

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center overflow-hidden bg-[#030814] px-6 text-white">
      {/* Deep ambient layers */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 55% at 50% 28%, rgba(56,189,248,0.22), transparent 55%), radial-gradient(ellipse 70% 40% at 50% 100%, rgba(37,99,235,0.14), transparent 50%)",
        }}
      />
      {/* Soft floating orbs */}
      <div
        className="pointer-events-none absolute left-[12%] top-[18%] size-24 rounded-full opacity-40 blur-3xl"
        style={{ background: "rgba(56,189,248,0.35)", animation: "taskora-float 5.5s ease-in-out infinite" }}
      />
      <div
        className="pointer-events-none absolute right-[8%] top-[42%] size-20 rounded-full opacity-30 blur-3xl"
        style={{ background: "rgba(37,99,235,0.4)", animation: "taskora-float 7s ease-in-out infinite reverse" }}
      />
      <div
        className="pointer-events-none absolute bottom-[22%] left-[22%] size-16 rounded-full opacity-25 blur-2xl"
        style={{ background: "rgba(14,165,233,0.35)", animation: "taskora-float 6.2s ease-in-out infinite" }}
      />

      <style>{`
        @keyframes taskora-float {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-14px) scale(1.06); }
        }
        @keyframes taskora-ring-a {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes taskora-ring-b {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(-360deg); }
        }
        @keyframes taskora-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes taskora-pulse-soft {
          0%, 100% { opacity: 0.55; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.08); }
        }
      `}</style>

      <div className="relative z-10 flex w-full flex-col items-center">
        {/* Logo stack — dual rings + glow */}
        <div className="relative mb-7">
          <div
            className="absolute -inset-6 rounded-full opacity-50 blur-2xl"
            style={{
              background: "radial-gradient(circle, rgba(56,189,248,0.5), transparent 68%)",
              animation: phase === "loading" ? "taskora-pulse-soft 2.2s ease-in-out infinite" : undefined,
            }}
          />
          {phase === "loading" ? (
            <>
              <div
                className="absolute -inset-3 rounded-full border-[2.5px] border-transparent"
                style={{
                  borderTopColor: "rgba(56,189,248,0.95)",
                  borderRightColor: "rgba(56,189,248,0.25)",
                  animation: "taskora-ring-a 1.05s linear infinite",
                }}
              />
              <div
                className="absolute -inset-[18px] rounded-full border border-cyan-400/20"
                style={{
                  borderBottomColor: "rgba(37,99,235,0.7)",
                  borderLeftColor: "rgba(37,99,235,0.15)",
                  animation: "taskora-ring-b 1.7s linear infinite",
                }}
              />
            </>
          ) : null}
          <img
            src={logoSrc}
            alt="TASKORA"
            className="relative size-[7.25rem] rounded-full object-cover shadow-[0_0_56px_rgba(56,189,248,0.45)] ring-2 ring-cyan-400/55"
            onError={() => {
              if (logoSrc !== TASKORA_WELCOME_IMAGE) setLogoSrc(TASKORA_WELCOME_IMAGE);
            }}
          />
        </div>

        <p
          className="text-[24px] font-black tracking-[0.16em]"
          style={{
            background: "linear-gradient(90deg,#e0f2fe,#38bdf8,#2563eb)",
            WebkitBackgroundClip: "text",
            color: "transparent",
          }}
        >
          TASKORA
        </p>
        <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.32em] text-cyan-300/65">
          Earn · Play · Grow
        </p>

        {phase === "loading" || phase === "welcome" ? (
          <div className="mt-11 w-full max-w-xs">
            {phase === "welcome" ? (
              <div className="text-center">
                <p className="text-lg font-black text-white">
                  Welcome, {welcomeName}
                  {goOwner ? (
                    <span className="ml-1.5 rounded-full bg-cyan-400/15 px-2 py-0.5 text-[10px] font-bold text-cyan-300">
                      Owner
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 text-[12px] text-slate-400">Opening your dashboard…</p>
              </div>
            ) : (
              <>
                <p className="text-center text-sm font-bold text-cyan-50">{stage.title}</p>
                <p className="mt-1 text-center text-[12px] text-slate-400">{stage.detail}</p>
              </>
            )}

            {/* Shimmer progress */}
            <div className="mt-6 h-[6px] overflow-hidden rounded-full bg-white/[0.08] ring-1 ring-white/[0.04]">
              <div
                className="relative h-full rounded-full transition-[width] duration-150 ease-out"
                style={{
                  width: `${Math.min(100, progress)}%`,
                  background: BLUE_GRAD,
                }}
              >
                <div
                  className="absolute inset-0 opacity-70"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)",
                    backgroundSize: "200% 100%",
                    animation: "taskora-shimmer 1.4s linear infinite",
                  }}
                />
              </div>
            </div>
            <p className="mt-2.5 text-center text-[11px] font-semibold tabular-nums tracking-wide text-cyan-300/85">
              {phase === "welcome" ? "Ready" : `${Math.floor(progress)}%`}
            </p>
          </div>
        ) : null}

        {phase === "need-telegram" || phase === "error" ? (
          <div className="mt-9 w-full max-w-sm rounded-2xl border border-slate-500/25 bg-white/[0.04] p-5 text-center shadow-[0_20px_50px_rgba(0,0,0,0.35)] backdrop-blur-md">
            <p className="text-sm leading-relaxed text-slate-200">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 w-full rounded-2xl px-4 py-3.5 text-sm font-bold text-white shadow-[0_8px_24px_rgba(37,99,235,0.35)]"
              style={{ background: BLUE_GRAD }}
            >
              Retry
            </button>
            <p className="mt-3.5 text-[11px] text-slate-500">
              Telegram → @Taskoraplusbot → Open TASKORA
            </p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
