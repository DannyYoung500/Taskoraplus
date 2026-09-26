import { createFileRoute } from "@tanstack/react-router";
import { alertStuckWithdrawals } from "@/lib/strong-wave.functions";

export const Route = createFileRoute("/api/cron/stuck-withdrawals")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const secret =
            process.env["CRON_SECRET"] ??
            process.env["TASKORA_CRON_SECRET"] ??
            "";
          const auth = request.headers.get("authorization") ?? "";
          const xCron = request.headers.get("x-cron-secret") ?? "";
          const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
          const ok = Boolean(secret) && (token === secret || xCron === secret);
          if (!ok && process.env["VERCEL"]) {
            if (!secret || auth !== `Bearer ${secret}`) {
              return new Response(JSON.stringify({ error: "unauthorized" }), {
                status: 401,
                headers: { "content-type": "application/json" },
              });
            }
          } else if (!ok) {
            return new Response(JSON.stringify({ error: "unauthorized" }), {
              status: 401,
              headers: { "content-type": "application/json" },
            });
          }
          const result = await alertStuckWithdrawals();
          return new Response(JSON.stringify({ ok: true, ...result }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (e) {
          return new Response(
            JSON.stringify({ ok: false, error: e instanceof Error ? e.message : "error" }),
            { status: 500, headers: { "content-type": "application/json" } },
          );
        }
      },
    },
  },
});
