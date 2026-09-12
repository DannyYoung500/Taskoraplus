import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

/**
 * Telegram-native entry only.
 * Google / email / password registration is forbidden by the master product spec.
 * Full initData HMAC validation must complete on the server before any session is trusted.
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
        colorScheme?: string;
      };
    };
  }
}

function AuthScreen() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "need-telegram" | "ready" | "error">("checking");
  const [message, setMessage] = useState<string | null>(null);

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
      setMessage("Open TASKORA from your Telegram bot. Browser email/Google login is not supported.");
      return;
    }

    setStatus("ready");
  }, []);

  async function continueWithTelegram() {
    setMessage(null);
    const initData = window.Telegram?.WebApp?.initData ?? "";
    if (!initData) {
      setStatus("need-telegram");
      setMessage("Telegram initData missing. Launch from the bot Mini App button.");
      return;
    }

    // Session must be created only after server-side initData validation.
    // Wire to a server function that validates HMAC with the bot token, then issues a session.
    setMessage("Telegram session bridge is not fully wired yet. Server must validate initData before entry.");
    setStatus("error");
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
          Sign-in is Telegram-only. There is no Google login, email login, or password registration.
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

        {message && status === "error" ? (
          <p className="text-center text-xs text-warning">{message}</p>
        ) : null}
      </div>
    </main>
  );
}
