import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getTelegramGateStatus } from "@/lib/telegram-gate.functions";
import { getAccountAccess } from "@/lib/account-access.functions";
import { touchPresence } from "@/lib/presence.functions";

declare global {
  interface Window {
    Telegram?: { WebApp?: { initData?: string } };
    __taskoraNavCache?: {
      userId?: string;
      accessOkUntil?: number;
      accessState?: string;
      gateOkUntil?: number;
      gateAllowed?: boolean;
    };
  }
}

/** Client-side nav cache — stops 4 server round-trips on every button press. */
const ACCESS_TTL_MS = 90_000;
const GATE_TTL_MS = 120_000;
const PRESENCE_MIN_GAP_MS = 45_000;
let lastPresenceAt = 0;

function cache(): NonNullable<Window["__taskoraNavCache"]> {
  if (typeof window === "undefined") return {};
  if (!window.__taskoraNavCache) window.__taskoraNavCache = {};
  return window.__taskoraNavCache;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data: sess } = await supabase.auth.getSession();
    const sessionUser = sess.session?.user;
    if (!sess.session?.access_token || !sessionUser?.id) {
      throw redirect({ to: "/" });
    }
    const userId = sessionUser.id;
    const path = location.pathname || "";
    const c = cache();
    c.userId = userId;

    const now = Date.now();
    if (now - lastPresenceAt > PRESENCE_MIN_GAP_MS) {
      lastPresenceAt = now;
      void touchPresence().catch(() => undefined);
    }

    if (!c.accessOkUntil || now > c.accessOkUntil || c.accessState !== "ok") {
      try {
        const access = await getAccountAccess();
        c.accessState = access.state;
        c.accessOkUntil = now + ACCESS_TTL_MS;
        if (access.state === "banned") throw redirect({ to: "/banned" });
        if (access.state === "suspended") throw redirect({ to: "/suspended" });
        if (access.state === "maintenance" && !path.startsWith("/owner")) {
          throw redirect({ to: "/maintenance" });
        }
      } catch (e) {
        if (e && typeof e === "object" && "to" in (e as object)) throw e;
        c.accessState = "ok";
        c.accessOkUntil = now + 15_000;
      }
    } else if (c.accessState === "banned") {
      throw redirect({ to: "/banned" });
    } else if (c.accessState === "suspended") {
      throw redirect({ to: "/suspended" });
    } else if (c.accessState === "maintenance" && !path.startsWith("/owner")) {
      throw redirect({ to: "/maintenance" });
    }

    if (path.startsWith("/owner") || path === "/telegram-gate") {
      return { user: { id: userId } };
    }

    const initData =
      typeof window !== "undefined" ? (window.Telegram?.WebApp?.initData ?? "") : "";

    if (!initData) {
      return { user: { id: userId } };
    }

    if (c.gateOkUntil && now < c.gateOkUntil && c.gateAllowed === true) {
      return { user: { id: userId } };
    }

    try {
      const status = await getTelegramGateStatus({ data: { initData, force: false } });
      c.gateAllowed = Boolean(status.allowed);
      c.gateOkUntil = now + GATE_TTL_MS;
      if (status.allowed) {
        return { user: { id: userId } };
      }
      throw redirect({ to: "/telegram-gate" });
    } catch (e) {
      if (e && typeof e === "object" && "to" in (e as object)) throw e;
      c.gateAllowed = true;
      c.gateOkUntil = now + 20_000;
      return { user: { id: userId } };
    }
  },
  component: () => <Outlet />,
});
