import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type SignalInput = {
  deviceFp?: string;
  timezone?: string;
  language?: string;
  screen?: string;
};

async function sha256(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function clientIp(request?: Request): string {
  const h = request?.headers;
  return (
    h?.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() ||
    h?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h?.get("x-real-ip")?.trim() ||
    ""
  );
}

export const recordSecuritySignal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: SignalInput) => d ?? {})
  .handler(async ({ data, context, request }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const rawIp = clientIp(request);
    const secret = process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "taskora-risk";
    const ipHint = rawIp ? await sha256(secret + ":" + rawIp) : null;
    const deviceFp = data.deviceFp?.trim().slice(0, 128) || null;
    const metadata = {
      timezone: data.timezone?.trim().slice(0, 80) || null,
      language: data.language?.trim().slice(0, 32) || null,
      screen: data.screen?.trim().slice(0, 32) || null,
      source: "webapp",
    };

    await supabaseAdmin.from("risk_signal_events").insert({
      user_id: context.userId,
      event_type: "heartbeat",
      ip_hint: ipHint,
      device_fp: deviceFp,
      metadata,
    } as never);

    const { data: previous } = await supabaseAdmin
      .from("profiles")
      .select("device_fp,last_ip_hint")
      .eq("id", context.userId)
      .maybeSingle();

    await supabaseAdmin
      .from("profiles")
      .update({
        device_fp: deviceFp,
        last_ip_hint: ipHint,
        last_seen_at: new Date().toISOString(),
        timezone: metadata.timezone,
      } as never)
      .eq("id", context.userId);

    const lookback = new Date(Date.now() - 30 * 86400_000).toISOString();
    let deviceMatches = 0;
    let ipMatches = 0;

    if (deviceFp) {
      const { count } = await supabaseAdmin
        .from("risk_signal_events")
        .select("user_id", { count: "exact", head: true })
        .eq("device_fp", deviceFp)
        .neq("user_id", context.userId)
        .gte("created_at", lookback);
      deviceMatches = count ?? 0;
    }

    if (ipHint) {
      const { count } = await supabaseAdmin
        .from("risk_signal_events")
        .select("user_id", { count: "exact", head: true })
        .eq("ip_hint", ipHint)
        .neq("user_id", context.userId)
        .gte("created_at", lookback);
      ipMatches = count ?? 0;
    }

    const signals: string[] = [];
    let delta = 0;

    if (deviceMatches > 0) {
      delta += Math.min(35, 20 + deviceMatches * 5);
      signals.push("Device identifier seen on another account");
    }
    if (ipMatches >= 2) {
      delta += Math.min(20, 5 + ipMatches * 3);
      signals.push("IP signature shared by multiple accounts");
    }

    if (signals.length) {
      const { data: existing } = await supabaseAdmin
        .from("fraud_flags")
        .select("id")
        .eq("user_id", context.userId)
        .eq("kind", "identity_overlap")
        .eq("status", "open")
        .maybeSingle();

      if (!existing) {
        await supabaseAdmin.from("fraud_flags").insert({
          user_id: context.userId,
          kind: "identity_overlap",
          severity: deviceMatches > 0 ? "high" : "medium",
          status: "open",
          details: signals.join(" · "),
          metadata: {
            device_matches: deviceMatches,
            ip_matches: ipMatches,
            observed_at: new Date().toISOString(),
          },
        } as never);
      }
    }

    if (delta > 0) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("risk_score,risk_band")
        .eq("id", context.userId)
        .maybeSingle();
      const current = Number(profile?.risk_score ?? 0);
      const score = Math.min(100, Math.max(current, delta));
      const band = score >= 80 ? "critical" : score >= 60 ? "high" : score >= 30 ? "medium" : "low";
      await supabaseAdmin
        .from("profiles")
        .update({ risk_score: score, risk_band: band } as never)
        .eq("id", context.userId);
    }

    return {
      ok: true,
      deviceMatches,
      ipMatches,
      signals,
      previousDevice: Boolean(previous?.device_fp),
    };
  });
