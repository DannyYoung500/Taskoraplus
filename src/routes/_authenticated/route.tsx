import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getTelegramGateStatus } from "@/lib/telegram-gate.functions";

declare global {
  interface Window { Telegram?: { WebApp?: { initData?: string } } }
}

async function verifyGate() {
  const initData = window.Telegram?.WebApp?.initData ?? "";
  if (!initData) return false;
  const gate = await getTelegramGateStatus({ data: { initData, force: true } });
  if (!gate.allowed && !gate.temporaryError) {
    window.location.assign("/telegram-gate");
    return false;
  }
  return true;
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
    try { await verifyGate(); } catch { /* preserve access if Telegram API is temporarily unavailable */ }
    return { user: { id: data.user.id } };
  },
  component: () => <GateMonitor><Outlet /></GateMonitor>,
});

function GateMonitor({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    const check = () => { void verifyGate().catch(() => undefined); };
    const timer = window.setInterval(check, 15000);
    document.addEventListener("visibilitychange", check);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", check); };
  }, []);
  return <>{children}</>;
}
