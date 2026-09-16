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
            const secret = process.env["TELEGRAM_WEBHOOK_SECRET"];
            if (secret) {
              const hdr = request.headers.get("x-telegram-bot-api-secret-token");
              if (hdr !== secret) {
                console.warn("[telegram-webhook] secret mismatch");
                return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
                  status: 200,
                  headers: { "content-type": "application/json" },
                });
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
