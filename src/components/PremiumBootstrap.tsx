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
      };
    };
  }
}

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

const STAGE_MS = 320;
const FINAL_HOLD_MS = 600;
const WELCOME_MS = 650;
const MIN_TOTAL_MS = 2400;

export function PremiumBootstrap({ redirectTo = "/home" }: { redirectTo?: string }) {
  const navigate = useNavigate();
  const [progress, setProgress] = useState(0);
  const [stageIndex, setStageIndex] = useState(0);
  const [phase, setPhase] = useState<"loading" | "welcome" | "error" | "need-telegram">("loading");
  const [error, setError] = useState<string | null>(null);
  const [welcomeName, setWelcomeName] = useState("Tasker");
  const [goOwner, setGoOwner] = useState(false);
  const [logoSrc, setLogoSrc] = useState(TASKORA_LOGO);
  const started = useRef(false);
  const authPromise = useRef<Promise<void> | null>(null);
  const authResult = useRef<{ ok: boolean; firstName?: string; isOwner?: boolean; error?: string }>({
    ok: false,
  });

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    try {
      tg?.ready?.();
      tg?.expand?.();
      tg?.setHeaderColor?.("#0b1424");
      tg?.setBackgroundColor?.("#0b1424");
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
        const startPct = (i / STAGES.length) * 100;
        const endPct = ((i + 1) / STAGES.length) * 100;
        setProgress(startPct);
        const hold = i === STAGES.length - 1 ? FINAL_HOLD_MS : STAGE_MS;
        const steps = Math.max(3, Math.floor(hold / 50));
        for (let s = 1; s <= steps; s++) {
          await new Promise((r) => window.setTimeout(r, hold / steps));
          setProgress(startPct + ((endPct - startPct) * s) / steps);
          if (authResult.current.ok && i >= 5) break;
        }
        if (authResult.current.ok && i >= 6) {
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
      // Everyone (including owner) opens Home. Owner console is opened from Profile / link.
      const dest = redirectTo;
      window.setTimeout(() => {
        navigate({ to: dest as "/home", replace: true });
      }, WELCOME_MS);
    }

    void sequence();
  }, [navigate, redirectTo]);

  const stage = STAGES[stageIndex]!;

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center overflow-hidden bg-[#0b1424] px-6 text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 28%, rgba(59,130,246,0.22), transparent 52%), radial-gradient(ellipse at 50% 95%, rgba(37,99,235,0.08), transparent 45%)",
        }}
      />

      <div className="relative z-10 flex w-full flex-col items-center">
        <div className="relative mb-5">
          <div className="absolute -inset-5 rounded-full bg-blue-500/25 blur-2xl" />
          <img
            src={logoSrc}
            alt="TASKORA"
            className="relative size-40 rounded-full object-cover shadow-[0_0_48px_rgba(59,130,246,0.45)] ring-2 ring-blue-400/40"
            onError={() => {
              if (logoSrc !== TASKORA_WELCOME_IMAGE) setLogoSrc(TASKORA_WELCOME_IMAGE);
            }}
          />
        </div>

        <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-blue-300/80">TASKORA</p>
        <h1 className="mt-2 text-center text-2xl font-bold tracking-tight text-white">
          {phase === "welcome"
            ? `Welcome, ${welcomeName}${goOwner ? " · Owner" : ""}`
            : "Verified Tasks. Real Rewards."}
        </h1>
        <p className="mt-1 text-center text-xs text-slate-400">@Taskoraplusbot</p>

        {phase === "loading" || phase === "welcome" ? (
          <div className="mt-10 w-full max-w-xs">
            <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300">
              {stage.title}
            </p>
            <p className="mt-1.5 text-center text-xs text-slate-400">{stage.detail}</p>
            <div className="mt-4 mb-2 flex items-center justify-between text-[11px] text-slate-400">
              <span>
                Step {stageIndex + 1} of {STAGES.length}
              </span>
              <span className="font-semibold tabular-nums text-blue-300">{Math.floor(progress)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-[width] duration-150 ease-out"
                style={{ width: `${progress}%`, background: BLUE_GRAD }}
              />
            </div>
            {phase === "welcome" ? (
              <p className="mt-4 text-center text-sm text-slate-300">Opening TASKORA…</p>
            ) : (
              <p className="mt-3 text-center text-[10px] text-slate-500">Please wait — finishing setup</p>
            )}
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
