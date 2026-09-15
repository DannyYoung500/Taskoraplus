import { useEffect } from "react";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getTelegramGateStatus } from "@/lib/telegram-gate.functions";

declare global {
  interface Window {
    Telegram?: { WebApp?: { initData?: string } };
  }
}

/**
 * Fail-closed: if gate is enabled and user is not a member → lock.
 * Temporary Telegram API errors also send user to the gate screen (retry UI),
 * rather than silently allowing access.
 */
async function verifyGate(): Promise<void> {
  const initData = window.Telegram?.WebApp?.initData ?? "";
  if (!initData) return;

  try {
    const gate = await getTelegramGateStatus({ data: { initData, force: true } });
    if (!gate.allowed) {
      window.location.assign("/telegram-gate");
    }
  } catch {
    // Invalid initData / identity mismatch → force re-entry via gate
    window.location.assign("/telegram-gate");
  }
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session?.access_token) throw redirect({ to: "/" });
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.id) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      throw redirect({ to: "/" });
    }
    // Soft check on navigation; hard lock redirects to /telegram-gate
    try {
      await verifyGate();
    } catch {
      /* redirect already handled inside verifyGate */
    }
    return { user: { id: data.user.id } };
  },
  component: () => (
    <GateMonitor>
      <Outlet />
    </GateMonitor>
  ),
});

function GateMonitor({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const check = () => {
      void verifyGate();
    };
    // Periodic re-check so leaving a required chat locks access (~15s)
    const timer = window.setInterval(check, 15_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  return <>{children}</>;
}
