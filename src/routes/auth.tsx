import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { validateTelegramSession } from "@/lib/taskora.functions";

/**
 * Telegram-native entry only.
 * Google / email / password registration is forbidden.
 */
export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Open TASKORA" },
      {
        name: "description",
        content: "Open TASKORA inside Telegram. Verified tasks. Real rewards.",
      },
    ],
  }),
  component: AuthScreen,
});

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: { user?: { id?: number; first_name?: string; username?: string } };
        ready?: () => void;
        expand?: () => void;
      };
    };
  }
}

function AuthScreen() {
  const [status, setStatus] = useState<"checking" | "need-telegram" | "ready" | "valid" | "error">(
    "checking",
  );
  const [message, setMessage] = useState<string | null>(null);
  const [identity, setIdentity] = useState<string | null>(null);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    try {
      tg?.ready?.();
      tg?.expand?.();
    } catch {
      /* ignore */
    }

    const initData = tg?.initData ?? "";
    if (!initData) {
      setStatus("need-telegram");
      setMessage("Open TASKORA from your Telegram bot Mini App button. Browser login is not supported.");
      return;
    }
    setStatus("ready");
  }, []);

  async function continueWithTelegram() {
    setMessage(null);
    const initData = window.Telegram?.WebApp?.initData ?? "";
    if (!initData) {
      setStatus("need-telegram");
      setMessage("Telegram initData missing.");
      return;
    }

    try {
      const result = await validateTelegramSession({ data: { initData } });
      setIdentity(
        [result.firstName, result.username ? `@${result.username}` : null, `id:${result.telegramId}`]
          .filter(Boolean)
          .join(" · "),
      );
      setStatus("valid");
      setMessage(
        result.sessionReady
          ? "Session ready."
          : "initData signature verified. Full app session bridge (link telegram_id → login) is the next deploy step — set TELEGRAM_BOT_TOKEN on the server.",
      );
    } catch (e) {
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Validation failed");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-6 text-center">
        <span className="bg-green-grad mx-auto inline-flex size-14 items-center justify-center rounded-2xl text-primary-foreground shadow-glow">
          <ShieldCheck className="size-7" />
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">TASKORA</h1>
        <p className="mt-1 text-sm text-muted-foreground">Verified Tasks. Real Rewards.</p>
      </div>

      <div className="card-surface space-y-4 p-5">
        <p className="text-sm text-muted-foreground">
          Sign-in is Telegram-only. No Google login, email, or password.
        </p>

        {status === "checking" ? (
          <p className="text-center text-xs text-muted-foreground">Checking Telegram environment…</p>
        ) : null}

        {status === "need-telegram" ? (
          <p className="text-center text-xs text-warning">{message}</p>
        ) : null}

        <button
          type="button"
          onClick={continueWithTelegram}
          disabled={status === "need-telegram" || status === "checking"}
          className="bg-green-grad w-full rounded-2xl px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50"
        >
          Continue with Telegram
        </button>

        {identity ? <p className="text-center text-xs text-muted-foreground">{identity}</p> : null}
        {message && status !== "need-telegram" ? (
          <p className="text-center text-xs text-warning">{message}</p>
        ) : null}
      </div>
    </main>
  );
}
