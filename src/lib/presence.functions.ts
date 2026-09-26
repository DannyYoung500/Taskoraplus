/**
 * Presence heartbeat — updates last_active_at + optional edge country.
 * Call from dashboard loaders (throttled server-side).
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const touchPresence = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: prev } = await supabaseAdmin
        .from("profiles")
        .select("last_active_at")
        .eq("id", userId)
        .maybeSingle();
      const prevMs = prev?.last_active_at ? new Date(String(prev.last_active_at)).getTime() : 0;
      if (Number.isFinite(prevMs) && Date.now() - prevMs < 2 * 60_000) {
        return { ok: true as const, skipped: true as const };
      }
      const patch: Record<string, unknown> = { last_active_at: new Date().toISOString() };
      try {
        const { getRequest } = await import("@tanstack/react-start/server");
        const { countryFromRequestHeaders } = await import("@/lib/locale-geo");
        const edge = countryFromRequestHeaders(getRequest()?.headers);
        if (edge.code) {
          patch.country_code = edge.code;
          if (edge.name) patch.country = edge.name;
        }
      } catch {
        /* ignore */
      }
      await supabaseAdmin.from("profiles").update(patch as never).eq("id", userId);
      try {
        const { getRequest } = await import("@tanstack/react-start/server");
        const req = getRequest();
        if (req?.headers) {
          const { fingerprintFromHeaders, touchDeviceFingerprint } = await import("@/lib/strong-ops");
          const fp = fingerprintFromHeaders(req.headers);
          const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip");
          await touchDeviceFingerprint({ userId, fingerprint: fp, ipHint: ip });
        }
      } catch {
        /* soft */
      }
      return { ok: true as const, skipped: false as const };
    } catch {
      return { ok: false as const, skipped: true as const };
    }
  });
