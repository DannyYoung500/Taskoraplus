import handler from "@tanstack/react-start/server-entry";
import { renderErrorPage } from "./lib/error-page";

let serverEntryPromise: Promise<typeof handler> | null = null;

function getServerEntry() {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then((m) => m.default);
  }
  return serverEntryPromise;
}

async function normalizeCatastrophicSsrResponse(response: Response) {
  return response;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      // Telegram bot webhook — handled before the SPA/SSR entry
      if (
        url.pathname === "/api/telegram-webhook" ||
        url.pathname === "/api/telegram/webhook" ||
        url.pathname === "/telegram-webhook"
      ) {
        if (request.method === "GET" || request.method === "HEAD") {
          return new Response(
            JSON.stringify({
              ok: true,
              service: "taskora-telegram-webhook",
              path: url.pathname,
              hasToken: Boolean(process.env["TELEGRAM_BOT_TOKEN"]),
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        if (request.method === "POST") {
          try {
            const secret = (process.env["TELEGRAM_WEBHOOK_SECRET"] || "").trim();
            if (secret) {
              const hdr = request.headers.get("x-telegram-bot-api-secret-token") || "";
              if (hdr && hdr !== secret) {
                console.warn("[telegram-webhook] secret mismatch (header present but wrong)");
                return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
                  status: 200,
                  headers: { "content-type": "application/json" },
                });
              }
              if (!hdr) {
                console.warn(
                  "[telegram-webhook] TELEGRAM_WEBHOOK_SECRET set but Telegram sent no secret header — processing anyway. Re-register webhook with matching secret.",
                );
              }
            }
            if (!process.env["TELEGRAM_BOT_TOKEN"]) {
              console.error("[telegram-webhook] TELEGRAM_BOT_TOKEN missing");
              return new Response(JSON.stringify({ ok: false, error: "bot_token_missing" }), {
                status: 200,
                headers: { "content-type": "application/json" },
              });
            }
            const update = (await request.json()) as Record<string, unknown>;
            const { handleTelegramUpdate } = await import("./lib/bot-welcome.functions");
            const result = await handleTelegramUpdate(update as never);
            return new Response(JSON.stringify({ ok: true, ...result }), {
              status: 200,
              headers: { "content-type": "application/json" },
            });
          } catch (e) {
            console.error("[telegram-webhook]", e);
            return new Response(
              JSON.stringify({
                ok: false,
                error: e instanceof Error ? e.message : "error",
              }),
              { status: 200, headers: { "content-type": "application/json" } },
            );
          }
        }
        return new Response("Method Not Allowed", { status: 405 });
      }

      const entry = await getServerEntry();
      const response = await entry.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
