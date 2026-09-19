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

/** Fast premium boot — Telegram Mini App best practice: ready() first, short stages, no white screen */
const STAGES = [
  { title: "Connecting", detail: "Secure Telegram session" },
  { title: "Signing in", detail: "Verifying your account" },
  { title: "Almost ready", detail: "Opening TASKORA" },
] as const;

const STAGE_MS = 220;
const WELCOME_MS = 450;
const MIN_TOTAL_MS = 900;

export function PremiumBootstrap({ redirectTo = "/home" }: { redirectTo?: string }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(8);
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
      const t0 = Date.now();
      authPromise.current = runAuth();

      for (let i = 0; i < STAGES.length; i++) {
        setStageIndex(i);
        const startPct = 8 + (i / STAGES.length) * 85;
        const endPct = 8 + ((i + 1) / STAGES.length) * 85;
        setProgress(startPct);
        const hold = STAGE_MS;
        const steps = Math.max(2, Math.floor(hold / 40));
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
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 32%, rgba(56,189,248,0.28), transparent 48%), radial-gradient(ellipse at 50% 100%, rgba(37,99,235,0.12), transparent 40%)",
        }}
      />

      <div className="relative z-10 flex w-full flex-col items-center">
        <div className="relative mb-6">
          <div
            className="absolute -inset-4 rounded-full opacity-60 blur-2xl"
            style={{ background: "radial-gradient(circle, rgba(56,189,248,0.45), transparent 70%)" }}
          />
          {phase === "loading" ? (
            <div
              className="absolute -inset-2 rounded-full border-2 border-cyan-400/30 border-t-cyan-300 animate-spin"
              style={{ animationDuration: "0.9s" }}
            />
          ) : null}
          <img
            src={logoSrc}
            alt="TASKORA"
            className="relative size-28 rounded-full object-cover shadow-[0_0_48px_rgba(56,189,248,0.4)] ring-2 ring-cyan-400/50"
            onError={() => {
              if (logoSrc !== TASKORA_WELCOME_IMAGE) setLogoSrc(TASKORA_WELCOME_IMAGE);
            }}
          />
        </div>

        <p
          className="text-[22px] font-black tracking-[0.14em]"
          style={{
            background: "linear-gradient(90deg,#e0f2fe,#38bdf8,#2563eb)",
            WebkitBackgroundClip: "text",
            color: "transparent",
          }}
        >
          TASKORA
        </p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.28em] text-cyan-300/70">
          Earn · Play · Grow
        </p>

        {phase === "loading" || phase === "welcome" ? (
          <div className="mt-10 w-full max-w-xs">
            {phase === "welcome" ? (
              <p className="text-center text-lg font-black text-white">
                Welcome, {welcomeName}
                {goOwner ? " · Owner" : ""}
              </p>
            ) : (
              <>
                <p className="text-center text-sm font-bold text-cyan-100">{stage.title}</p>
                <p className="mt-1 text-center text-[12px] text-slate-400">{stage.detail}</p>
              </>
            )}

            <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-[width] duration-150 ease-out"
                style={{ width: `${Math.min(100, progress)}%`, background: BLUE_GRAD }}
              />
            </div>
            <p className="mt-2 text-center text-[11px] font-semibold tabular-nums text-cyan-300/80">
              {phase === "welcome" ? "Opening…" : `${Math.floor(progress)}%`}
            </p>
          </div>
        ) : null}

        {phase === "need-telegram" || phase === "error" ? (
          <div className="mt-8 w-full max-w-sm rounded-2xl border border-slate-500/20 bg-white/5 p-5 text-center backdrop-blur">
            <p className="text-sm text-slate-200">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 w-full rounded-2xl px-4 py-3 text-sm font-bold text-white"
              style={{ background: BLUE_GRAD }}
            >
              Retry
            </button>
            <p className="mt-3 text-[11px] text-slate-500">Telegram → @Taskoraplusbot → Open TASKORA</p>
          </div>
        ) : null}
      </div>
    </main>
  );
}
