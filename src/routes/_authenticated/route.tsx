import { useEffect, useRef } from "react";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getTelegramGateStatus } from "@/lib/telegram-gate.functions";

declare global {
  interface Window {
    Telegram?: { WebApp?: { initData?: string } };
  }
}

/** Session-level cache so we do not hit Telegram Bot API on every navigation. */
let gateCache: { allowed: boolean; checkedAt: number; enabled: boolean } | null = null;
const GATE_TTL_MS = 90_000; // 90s cache — was 15s forced re-check (very slow)

/**
 * Soft membership check. Fail-closed only when gate is enabled and user is
 * clearly not a member. Cached to keep Mini App pages fast.
 */
async function verifyGate(force = false): Promise<void> {
  const initData = window.Telegram?.WebApp?.initData ?? "";
  if (!initData) return;

  const now = Date.now();
  if (!force && gateCache && now - gateCache.checkedAt < GATE_TTL_MS) {
    if (gateCache.enabled && !gateCache.allowed) {
      window.location.assign("/telegram-gate");
    }
    return;
  }

  try {
    const gate = await getTelegramGateStatus({ data: { initData, force: false } });
    const enabled = Boolean(gate.configured && !("temporaryError" in gate && gate.temporaryError));
    // If gate is disabled or not configured, treat as allowed
    const allowed = gate.allowed || !gate.configured;
    gateCache = { allowed, checkedAt: now, enabled: Boolean(gate.configured) && enabled };

    if (gate.configured && !gate.allowed) {
      window.location.assign("/telegram-gate");
    }
  } catch {
    // Do NOT lock the whole app on transient errors during soft checks.
    // Hard lock only happens on the dedicated /telegram-gate screen.
    if (gateCache?.enabled && !gateCache.allowed) {
      window.location.assign("/telegram-gate");
    }
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
    // Non-blocking soft check using cache — does not delay every page load
    return { user: { id: data.user.id } };
  },
  component: () => (
    <GateMonitor>
      <Outlet />
    </GateMonitor>
  ),
});

function GateMonitor({ children }: { children: React.ReactNode }) {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // One soft check after mount (uses 90s cache thereafter)
    void verifyGate(false);
    // Rare re-check only when tab becomes visible again (not every 15s)
    const onVis = () => {
      if (document.visibilityState === "visible") void verifyGate(false);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  return <>{children}</>;
}
