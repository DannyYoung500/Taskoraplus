import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/telegram/broadcast/click")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const broadcastId = url.searchParams.get("b");
        const recipientId = url.searchParams.get("r");
        const buttonIndex = Number(url.searchParams.get("i"));
        const target = url.searchParams.get("u");
        if (!broadcastId || !target || !Number.isInteger(buttonIndex) || buttonIndex < 0) {
          return new Response("Invalid broadcast link", { status: 400 });
        }
        let destination: URL;
        try {
          destination = new URL(target);
          if (!/^https?:$/.test(destination.protocol)) throw new Error("bad protocol");
        } catch {
          return new Response("Invalid destination", { status: 400 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("telegram_broadcast_clicks").insert({
          broadcast_id: broadcastId,
          recipient_id: recipientId || null,
          button_index: buttonIndex,
        });
        const { count } = await supabaseAdmin.from("telegram_broadcast_clicks")
          .select("id", { count: "exact", head: true }).eq("broadcast_id", broadcastId);
        await supabaseAdmin.from("telegram_broadcasts").update({ click_count: count ?? 0 }).eq("id", broadcastId);
        return Response.redirect(destination.toString(), 302);
      },
    },
  },
});