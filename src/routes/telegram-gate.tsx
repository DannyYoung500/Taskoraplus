import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Lock, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getTelegramGateStatus } from "@/lib/telegram-gate.functions";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        openTelegramLink?: (url: string) => void;
        openLink?: (url: string) => void;
      };
    };
  }
}

const LOGO = "/file_00000000f8ec8246a98cce68ff972640.png";

export const Route = createFileRoute("/telegram-gate")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) {
      throw new Error("Open TASKORA from Telegram.");
    }
  },
  component: TelegramGateScreen,
});

type Phase = "locked" | "checking" | "verified" | "not_member" | "unavailable";

function TelegramGateScreen() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("locked");
  const [message, setMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState<{
    title: string;
    description: string;
    joinButtonText: string;
    checkButtonText: string;
    successMessage: string;
    failureMessage: string;
    channelUrl: string;
    channelName: string;
  } | null>(null);

  async function check(force = true) {
    setPhase("checking");
    setMessage(null);
    try {
      const initData = window.Telegram?.WebApp?.initData ?? "";
      if (!initData) {
        setPhase("unavailable");
        setMessage("Open TASKORA from @Taskoraplusbot inside Telegram.");
        return;
      }
      const result = await getTelegramGateStatus({ data: { initData, force } });
      if (result.settings) {
        setSettings({
          title: result.settings.title,
          description: result.settings.description,
          joinButtonText: result.settings.joinButtonText,
          checkButtonText: result.settings.checkButtonText,
          successMessage: result.settings.successMessage,
          failureMessage: result.settings.failureMessage,
          channelUrl: result.settings.channelUrl,
          channelName: result.settings.channelName,
        });
      }
      if (result.allowed) {
        setPhase("verified");
        window.setTimeout(() => navigate({ to: "/home", replace: true }), 1200);
        return;
      }
      if ("temporaryError" in result && result.temporaryError) {
        setPhase("unavailable");
        setMessage(String(result.temporaryError));
        return;
      }
      setPhase("not_member");
      setMessage(result.settings?.failureMessage ?? "CHANNEL MEMBERSHIP NOT FOUND");
    } catch (e) {
      setPhase("unavailable");
      setMessage(e instanceof Error ? e.message : "Verification temporarily unavailable.");
    }
  }

  function joinChannel() {
    const url = settings?.channelUrl?.trim() || "https://t.me/";
    try {
      if (window.Telegram?.WebApp?.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(url);
      } else if (window.Telegram?.WebApp?.openLink) {
        window.Telegram.WebApp.openLink(url);
      } else {
        window.open(url, "_blank");
      }
    } catch {
      window.open(url, "_blank");
    }
  }

  const title = settings?.title ?? "JOIN TASKORA COMMUNITY";
  const description =
    settings?.description ??
    "Join our official Telegram channel to unlock TASKORA and start earning.";

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center overflow-hidden bg-[#05070c] px-5 text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 20%, rgba(245,197,66,0.14), transparent 50%), radial-gradient(ellipse at 50% 100%, rgba(34,158,217,0.08), transparent 40%)",
        }}
      />

      <div className="relative z-10 w-full">
        <div className="mb-6 flex flex-col items-center">
          <img
            src={LOGO}
            alt="TASKORA"
            className="size-20 rounded-full object-cover shadow-[0_0_36px_rgba(245,197,66,0.35)]"
          />
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-200/70">
            TASKORA
          </p>
          <h1 className="mt-2 text-center text-xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-2 max-w-sm text-center text-xs leading-relaxed text-white/50">{description}</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#12141c] p-5">
          {phase === "locked" || phase === "not_member" ? (
            <Status
              icon={<Lock className="size-5 text-amber-300" />}
              label="ACCESS LOCKED"
              detail="Telegram membership required"
            />
          ) : null}
          {phase === "checking" ? (
            <Status
              icon={<Loader2 className="size-5 animate-spin text-amber-300" />}
              label="VERIFYING MEMBERSHIP..."
              detail="Checking your Telegram channel status"
            />
          ) : null}
          {phase === "verified" ? (
            <Status
              icon={<CheckCircle2 className="size-5 text-emerald-400" />}
              label="MEMBERSHIP VERIFIED"
              detail={settings?.successMessage ?? "Your TASKORA access has been unlocked."}
            />
          ) : null}
          {phase === "unavailable" ? (
            <Status
              icon={<AlertTriangle className="size-5 text-amber-200" />}
              label="VERIFICATION TEMPORARILY UNAVAILABLE"
              detail={message ?? "Please try again in a moment."}
            />
          ) : null}

          {phase === "not_member" && message ? (
            <p className="mt-3 text-center text-xs text-white/45">{message}</p>
          ) : null}

          {phase !== "verified" && phase !== "checking" ? (
            <div className="mt-5 space-y-2.5">
              <button
                type="button"
                onClick={joinChannel}
                className="w-full rounded-2xl px-4 py-3.5 text-sm font-extrabold text-white"
                style={{ background: "linear-gradient(135deg,#2AABEE,#229ED9)" }}
              >
                {settings?.joinButtonText ?? "JOIN TELEGRAM CHANNEL"}
              </button>
              <button
                type="button"
                onClick={() => void check(true)}
                className="w-full rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3.5 text-sm font-bold text-amber-200"
              >
                {settings?.checkButtonText ?? "CHECK MEMBERSHIP"}
              </button>
            </div>
          ) : null}

          {phase === "checking" ? (
            <p className="mt-4 text-center text-[11px] text-white/35">This may take a few seconds…</p>
          ) : null}
        </div>

        {settings?.channelName ? (
          <p className="mt-4 text-center text-[11px] text-white/35">Channel · {settings.channelName}</p>
        ) : null}
      </div>
    </main>
  );
}

function Status({ icon, label, detail }: { icon: ReactNode; label: string; detail: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-3 inline-flex size-12 items-center justify-center rounded-2xl bg-white/5">{icon}</div>
      <p className="text-sm font-bold tracking-wide">{label}</p>
      <p className="mt-1 text-xs text-white/45">{detail}</p>
    </div>
  );
}
