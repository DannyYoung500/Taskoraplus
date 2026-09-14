import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getTelegramGateStatus } from "@/lib/telegram-gate.functions";

declare global {
  interface Window {
    Telegram?: { WebApp?: { initData?: string } };
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

    const initData = window.Telegram?.WebApp?.initData ?? "";
    if (initData) {
      try {
        const gate = await getTelegramGateStatus({ data: { initData, force: false } });
        if (!gate.allowed) throw redirect({ to: "/telegram-gate" });
      } catch (e) {
        // Soft-fail: do not block the whole app if gate tables/API misconfigured
        // Redirect only when the server explicitly denied membership
        if (e && typeof e === "object" && "to" in e) throw e;
        // otherwise continue — owner can fix config
      }
    }

    return { user: { id: data.user.id } };
  },
  component: () => <Outlet />,
});
