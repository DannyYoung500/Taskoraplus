import { createFileRoute } from "@tanstack/react-router";
import { runMembershipRecheckInternal } from "@/lib/strong-membership-recheck.functions";

/**
 * Manual/cron endpoint for membership leave-check.
 * NOT registered in vercel.json until development is finished.
 * Call with Authorization: Bearer $CRON_SECRET or x-cron-secret header.
 */
export const Route = createFileRoute("/api/cron/membership-recheck")({
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
          if (!ok) {
            return new Response(JSON.stringify({ error: "unauthorized" }), {
              status: 401,
              headers: { "content-type": "application/json" },
            });
          }
          const url = new URL(request.url);
          const minAgeHours = Number(url.searchParams.get("minAgeHours") || 20);
          const maxAgeHours = Number(url.searchParams.get("maxAgeHours") || 72);
          const limit = Number(url.searchParams.get("limit") || 80);
          const platform = (url.searchParams.get("platform") || "all") as
            | "all"
            | "telegram"
            | "discord";
          const result = await runMembershipRecheckInternal({
            minAgeHours,
            maxAgeHours,
            limit,
            platform,
          });
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
