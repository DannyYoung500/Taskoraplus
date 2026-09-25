import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  const captured = consumeLastCapturedError();
  console.error("[ssr] catastrophic", captured ?? body);
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);
      // Telegram webhook — accept common paths so bot registration always hits the handler
      if (
        url.pathname === "/api/telegram-webhook" ||
        url.pathname === "/api/telegram/webhook" ||
        url.pathname === "/telegram-webhook"
      ) {
        if (request.method === "GET" || request.method === "HEAD") {
          const token = process.env["TELEGRAM_BOT_TOKEN"];
          if (!token) return new Response(JSON.stringify({ ok: false, service: "taskora-telegram-webhook", error: "TELEGRAM_BOT_TOKEN missing" }), { status: 503, headers: { "content-type": "application/json" } });
          try {
            const tg = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
            const result = (await tg.json()) as { ok?: boolean; description?: string; result?: unknown };
            return new Response(JSON.stringify({ ok: Boolean(result.ok), service: "taskora-telegram-webhook", webhook: result.ok ? result.result : null, telegram: result.ok ? "connected" : result.description || "status_failed" }), { status: result.ok ? 200 : 502, headers: { "content-type": "application/json" } });
          } catch (e) {
            return new Response(JSON.stringify({ ok: false, service: "taskora-telegram-webhook", error: e instanceof Error ? e.message : "webhook_status_failed" }), { status: 502, headers: { "content-type": "application/json" } });
          }
        }
        if (request.method === "POST") {
          try {
            const secret = process.env["TELEGRAM_WEBHOOK_SECRET"];
            if (secret) {
              const hdr = request.headers.get("x-telegram-bot-api-secret-token");
              if (hdr !== secret) console.warn("[telegram-webhook] webhook secret differs from current env; processing update");
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

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
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
