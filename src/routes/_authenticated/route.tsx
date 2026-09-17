import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getTelegramGateStatus } from "@/lib/telegram-gate.functions";
import { getAccountAccess } from "@/lib/account-access.functions";

declare global {
  interface Window {
    Telegram?: { WebApp?: { initData?: string } };
  }
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data: sess } = await supabase.auth.getSession();
    if (!sess.session?.access_token) throw redirect({ to: "/" });

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user?.id) {
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      throw redirect({ to: "/" });
    }

    const path = location.pathname || "";

    try {
      const access = await getAccountAccess();
      if (access.state === "banned") throw redirect({ to: "/banned" });
      if (access.state === "suspended") throw redirect({ to: "/suspended" });
      if (access.state === "maintenance" && !path.startsWith("/owner")) {
        throw redirect({ to: "/maintenance" });
      }
    } catch (e) {
      if (e && typeof e === "object" && "to" in (e as object)) throw e;
    }

    if (path.startsWith("/owner") || path === "/telegram-gate") {
      return { user: { id: data.user.id } };
    }

    const initData =
      typeof window !== "undefined" ? (window.Telegram?.WebApp?.initData ?? "") : "";

    if (!initData) {
      return { user: { id: data.user.id } };
    }

    try {
      const status = await getTelegramGateStatus({ data: { initData, force: false } });
      if (status.allowed) {
        return { user: { id: data.user.id } };
      }
      throw redirect({ to: "/telegram-gate" });
    } catch (e) {
      if (e && typeof e === "object" && "to" in (e as object)) throw e;
      throw redirect({ to: "/telegram-gate" });
    }
  },
  component: () => <Outlet />,
});
