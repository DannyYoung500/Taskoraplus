import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

/**
 * Prefer Auth API getUser(jwt) over local JWKS getClaims.
 * Avoids "unrecognized JWT kid / ES256" when signing keys rotate or JWKS is stale.
 */
export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const SUPABASE_URL = process.env["SUPABASE_URL"] ?? "https://qvwetjpgplkhxuymsnyx.supabase.co";
    const SUPABASE_PUBLISHABLE_KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];

    if (!SUPABASE_PUBLISHABLE_KEY) {
      throw new Error("Missing SUPABASE_PUBLISHABLE_KEY");
    }

    const request = getRequest();
    if (!request?.headers) throw new Error("Unauthorized: No request headers available");

    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      throw new Error("Unauthorized: No authorization header provided");
    }
    const token = authHeader.slice("Bearer ".length).trim();
    if (!token || token.split(".").length !== 3) {
      throw new Error("Unauthorized: Invalid token");
    }

    const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      global: {
        fetch: createSupabaseFetch(SUPABASE_PUBLISHABLE_KEY),
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    });

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user?.id) {
      throw new Error("Unauthorized: Invalid token");
    }

    // Privacy-conscious fraud telemetry: keep only a masked IP hint and a
    // server-derived browser/device signature. Never persist the raw IP.
    const deviceMaterial = [
      request.headers.get("user-agent") ?? "",
      request.headers.get("accept-language") ?? "",
      request.headers.get("sec-ch-ua") ?? "",
      request.headers.get("sec-ch-ua-platform") ?? "",
      request.headers.get("sec-ch-ua-mobile") ?? "",
    ].join("|");
    const { createHash } = await import("node:crypto");
    const deviceFp = createHash("sha256").update(deviceMaterial).digest("hex").slice(0, 32);

    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      || request.headers.get("x-real-ip")
      || request.headers.get("cf-connecting-ip")
      || "";
    const ipHint = forwarded.includes(".")
      ? forwarded.split(".").slice(0, 3).join(".") + ".0"
      : forwarded.includes(":")
        ? forwarded.split(":").slice(0, 4).join(":") + ":*"
        : null;

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const userId = data.user.id;
      const { data: previous } = await supabaseAdmin
        .from("profiles")
        .select("device_fp,last_ip_hint,last_seen_at")
        .eq("id", userId)
        .maybeSingle();

      const now = new Date();
      const lastSeen = previous?.last_seen_at ? new Date(previous.last_seen_at).getTime() : 0;
      const changed = previous?.device_fp !== deviceFp || previous?.last_ip_hint !== ipHint;
      const stale = !lastSeen || now.getTime() - lastSeen > 5 * 60 * 1000;

      if (changed || stale) {
        await supabaseAdmin
          .from("profiles")
          .update({
            device_fp: deviceFp,
            last_ip_hint: ipHint,
            last_seen_at: now.toISOString(),
          })
          .eq("id", userId);

        await (supabaseAdmin as any).from("risk_signal_events").insert({
          user_id: userId,
          event_type: changed ? "identity_signal_changed" : "activity_seen",
          ip_hint: ipHint,
          device_fp: deviceFp,
          metadata: {
            ip_source: forwarded ? "proxy_header" : "none",
            user_agent_present: Boolean(request.headers.get("user-agent")),
          },
        });
      }
    } catch (telemetryError) {
      // Fraud telemetry must never break authentication or normal app requests.
      console.warn("[risk-telemetry]", telemetryError);
    }

    return next({
      context: {
        supabase,
        userId: data.user.id,
        claims: { sub: data.user.id, email: data.user.email },
      },
    });
  },
);
