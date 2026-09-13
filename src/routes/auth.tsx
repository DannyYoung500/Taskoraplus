import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { loginWithTelegram } from "@/lib/taskora.functions";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Open TASKORA" }, { name: "description", content: "Open TASKORA inside Telegram. Verified tasks. Real rewards." }] }),
  component: AuthScreen,
});

declare global { interface Window { Telegram?: { WebApp?: { initData?: string; ready?: () => void; expand?: () => void } } } }

function AuthScreen() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"checking" | "need-telegram" | "ready" | "busy" | "error">("checking");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    try { tg?.ready?.(); tg?.expand?.(); } catch { /* ignore */ }
    if (!(tg?.initData ?? "")) { setStatus("need-telegram"); setMessage("Open TASKORA from your Telegram bot Mini App button."); return; }
    setStatus("ready");
  }, []);

  async function continueWithTelegram() {
    setMessage(null);
    const initData = window.Telegram?.WebApp?.initData ?? "";
    if (!initData) { setStatus("need-telegram"); setMessage("Telegram initData missing."); return; }
    setStatus("busy");
    try {
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      const result = await loginWithTelegram({ data: { initData } });
      const { error } = await supabase.auth.setSession({ access_token: result.access_token, refresh_token: result.refresh_token });
      if (error) throw error;
      navigate({ to: "/home", replace: true });
    } catch (e) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      setStatus("error");
      setMessage(e instanceof Error ? e.message : "Telegram login failed");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-10">
      <div className="mb-6 text-center"><span className="bg-green-grad mx-auto inline-flex size-14 items-center justify-center rounded-2xl text-primary-foreground shadow-glow"><ShieldCheck className="size-7" /></span><h1 className="mt-4 text-2xl font-bold tracking-tight">TASKORA</h1><p className="mt-1 text-sm text-muted-foreground">Verified Tasks. Real Rewards.</p></div>
      <div className="card-surface space-y-4 p-5"><p className="text-sm text-muted-foreground">Telegram-only access. Your identity is verified with Telegram initData on the server.</p>
        {status === "need-telegram" ? <p className="text-center text-xs text-warning">{message}</p> : null}
        <button type="button" onClick={continueWithTelegram} disabled={status === "need-telegram" || status === "checking" || status === "busy"} className="bg-green-grad w-full rounded-2xl px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-glow disabled:opacity-50">{status === "busy" ? "Verifying…" : "Continue with Telegram"}</button>
        {message && status === "error" ? <p className="text-center text-xs text-warning">{message}</p> : null}
      </div>
    </main>
  );
}
