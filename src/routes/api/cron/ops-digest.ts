import { createFileRoute } from "@tanstack/react-router";
import { cronOpsDigest } from "@/lib/owner-payout-policy.functions";

/**
 * Vercel Cron → daily ops digest to owner Telegram.
 * Auth: Authorization: Bearer <CRON_SECRET> or x-cron-secret header.
 */
export const Route = createFileRoute("/api/cron/ops-digest")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const secret =
            process.env["CRON_SECRET"] ??
            process.env["TASKORA_CRON_SECRET"] ??
            process.env["LOVABLE_CRON_SECRET"] ??
            "";
          const auth = request.headers.get("authorization") ?? "";
          const xCron = request.headers.get("x-cron-secret") ?? "";
          const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
          const ok =
            Boolean(secret) && (token === secret || xCron === secret);
          // Vercel Cron sends Authorization: Bearer <CRON_SECRET> when configured
          if (!ok && !process.env["VERCEL"]) {
            return new Response(JSON.stringify({ error: "unauthorized" }), {
              status: 401,
              headers: { "content-type": "application/json" },
            });
          }
          if (!ok) {
            // On Vercel, also accept when CRON_SECRET matches Vercel's injected header
            const vercelAuth = request.headers.get("authorization");
            if (!secret || vercelAuth !== `Bearer ${secret}`) {
              return new Response(JSON.stringify({ error: "unauthorized" }), {
                status: 401,
                headers: { "content-type": "application/json" },
              });
            }
          }
          const result = await cronOpsDigest();
          return new Response(JSON.stringify(result ?? { ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "digest_failed";
          return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
      POST: async ({ request }) => {
        // Same handler as GET for flexibility
        try {
          const secret =
            process.env["CRON_SECRET"] ??
            process.env["TASKORA_CRON_SECRET"] ??
            process.env["LOVABLE_CRON_SECRET"] ??
            "";
          const auth = request.headers.get("authorization") ?? "";
          const xCron = request.headers.get("x-cron-secret") ?? "";
          const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
          const ok = Boolean(secret) && (token === secret || xCron === secret);
          if (!ok) {
            return new Response(JSON.stringify({ error: "unauthorized" }), {
              status: 401,
              headers: { "content-type": "application/json" },
            });
          }
          const result = await cronOpsDigest();
          return new Response(JSON.stringify(result ?? { ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "digest_failed";
          return new Response(JSON.stringify({ error: msg }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
