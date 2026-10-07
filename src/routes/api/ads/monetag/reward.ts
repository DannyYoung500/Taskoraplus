import { createFileRoute } from "@tanstack/react-router";

/**
 * Monetag server postback — credits only when reward_event_type is valued (or missing).
 * Configure in Monetag SSP:
 *   https://yourdomain.com/api/ads/monetag/reward?telegram_id={telegram_id}&ymid={ymid}&event={event_type}&value={reward_event_type}&secret=YOUR_SECRET
 */
export const Route = createFileRoute("/api/ads/monetag/reward")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { assertPostbackSecret, creditDailyMissionFromPostback } = await import(
            "@/lib/strong-tier-a.functions"
          );
          try {
            assertPostbackSecret(request.url);
          } catch {
            return Response.json({ ok: false, error: "unauthorized" }, { status: 401 });
          }

          const url = new URL(request.url);
          const value = (url.searchParams.get("value") || url.searchParams.get("reward_event_type") || "").toLowerCase();
          // Monetag: only credit valued events; skip non_valued / fraud filters
          if (value === "non_valued" || value === "non-valued") {
            return Response.json({ ok: true, credited: false, reason: "non_valued" });
          }

          const telegramId =
            url.searchParams.get("telegram_id") ||
            url.searchParams.get("userid") ||
            url.searchParams.get("userId") ||
            url.searchParams.get("ymid");
          if (!telegramId) {
            return Response.json({ ok: false, error: "telegram_id required" }, { status: 400 });
          }
          const claimId = url.searchParams.get("claimId") || url.searchParams.get("claim_id");
          const eventId = url.searchParams.get("ymid") || url.searchParams.get("eventId");

          const result = await creditDailyMissionFromPostback({
            telegramId: String(telegramId),
            providerKey: "monetag",
            claimId,
            eventId: eventId ? `monetag:${eventId}` : null,
          });
          if (!result.ok) {
            return Response.json(result, { status: 500 });
          }
          return Response.json(result);
        } catch (e) {
          return Response.json(
            { ok: false, error: e instanceof Error ? e.message : "error" },
            { status: 500 },
          );
        }
      },
    },
  },
});
