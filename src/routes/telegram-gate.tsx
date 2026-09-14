import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { getTelegramGateStatus, type TelegramGateSettings } from "@/lib/telegram-gate.functions";

export const Route = createFileRoute("/telegram-gate")({
  ssr: false,
  component: TelegramGate,
});

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        ready?: () => void;
        openTelegramLink?: (url: string) => void;
      };
    };
  }
}

function TelegramGate() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<TelegramGateSettings | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const check = async () => {
    const initData = window.Telegram?.WebApp?.initData ?? "";
    if (!initData) {
      setMessage("Open TASKORA from @Taskoraplusbot inside Telegram.");
      setChecking(false);
      return;
    }

    setChecking(true);
    try {
      const result = await getTelegramGateStatus({ data: { initData, force: true } });
      setSettings(result.settings);
      setStatus(result.membershipStatus ?? null);
      if (result.allowed) {
        navigate({ to: "/home", replace: true });
        return;
      }
      setMessage(result.temporaryError ?? result.settings.failureMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Membership verification failed. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    window.Telegram?.WebApp?.ready?.();
    void check();
  }, []);

  const openChannel = () => {
    const url = settings?.channelUrl;
    if (!url) return;
    try {
      window.Telegram?.WebApp?.openTelegramLink?.(url);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0c12] px-5 py-10 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-md flex-col justify-center">
        <div className="text-center">
          <div className="mx-auto flex size-20 items-center justify-center rounded-3xl border border-amber-300/20 bg-amber-300/10 text-4xl shadow-[0_0_45px_rgba(245,197,66,0.15)]">✈️</div>
          <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.3em] text-amber-300/70">TASKORA COMMUNITY</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">{settings?.title ?? "JOIN TASKORA COMMUNITY"}</h1>
          <p className="mt-3 text-sm leading-6 text-white/55">{settings?.description ?? "Join our official Telegram channel to unlock TASKORA and start earning."}</p>
        </div>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.045] p-5 shadow-2xl backdrop-blur-xl">
          <div className="rounded-2xl border border-amber-300/10 bg-black/20 px-4 py-4 text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300/80">ACCESS LOCKED</p>
            <p className="mt-1.5 text-xs text-white/45">Telegram membership is required before entering TASKORA.</p>
            {status ? <p className="mt-2 text-[11px] text-white/30">Current status: {status}</p> : null}
          </div>

          {message ? <p className="mt-4 text-center text-xs leading-5 text-rose-200/80">{message}</p> : null}

          <div className="mt-5 space-y-2.5">
            <button type="button" onClick={openChannel} disabled={!settings?.channelUrl || checking} className="w-full rounded-2xl px-4 py-3.5 text-sm font-extrabold text-[#0a0c12] disabled:cursor-not-allowed disabled:opacity-40" style={{ background: "linear-gradient(135deg, #FFE08A, #F5C542, #C9961A)" }}>
              {settings?.joinButtonText ?? "JOIN TELEGRAM CHANNEL"}
            </button>
            <button type="button" onClick={check} disabled={checking} className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3.5 text-sm font-bold text-white transition hover:bg-white/10 disabled:opacity-50">
              {checking ? "VERIFYING MEMBERSHIP…" : settings?.checkButtonText ?? "CHECK MEMBERSHIP"}
            </button>
          </div>

          <p className="mt-4 text-center text-[10px] leading-4 text-white/25">Join the official channel, return here, then check membership.</p>
        </section>
      </div>
    </main>
  );
}
