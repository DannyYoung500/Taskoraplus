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
  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), { status: 500, headers: { "content-type": "text/html; charset=utf-8" } });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
}

function constantTimeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

async function telegramApi(method: string, body: Record<string, unknown>) {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN not configured");
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { ok: boolean; description?: string; result?: unknown };
  if (!payload.ok) throw new Error(payload.description || `Telegram ${method} failed`);
  return payload.result;
}

function webhookSetupAuthorized(request: Request) {
  const expected = process.env["TELEGRAM_WEBHOOK_SETUP_SECRET"];
  if (!expected) return false;
  const supplied = request.headers.get("x-taskora-webhook-setup-secret") || "";
  return constantTimeEqual(supplied, expected);
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const url = new URL(request.url);

      if (url.pathname === "/api/telegram-webhook/setup") {
        if (!webhookSetupAuthorized(request)) return json({ ok: false, error: "unauthorized" }, 401);
        if (request.method !== "POST" && request.method !== "GET") return new Response("Method Not Allowed", { status: 405 });

        const secret = process.env["TELEGRAM_WEBHOOK_SECRET"];
        const webhookUrl = `${url.origin}/api/telegram-webhook`;
        const body: Record<string, unknown> = {
          url: webhookUrl,
          allowed_updates: ["message", "callback_query", "chat_member", "my_chat_member"],
        };
        if (secret) body.secret_token = secret;

        await telegramApi("setWebhook", body);
        const info = await telegramApi("getWebhookInfo", {});
        return json({ ok: true, webhook_url: webhookUrl, webhook_info: info });
      }

      if (url.pathname === "/api/telegram-webhook") {
        if (request.method === "GET") return json({ ok: true, service: "taskora-telegram-webhook" });
        if (request.method === "POST") {
          try {
            const secret = process.env["TELEGRAM_WEBHOOK_SECRET"];
            if (secret) {
              const supplied = request.headers.get("x-telegram-bot-api-secret-token") || "";
              if (!constantTimeEqual(supplied, secret)) return json({ ok: false, error: "unauthorized" }, 401);
            }
            const update = await request.json();
            const { handleTelegramUpdate } = await import("./lib/bot-welcome.functions");
            const result = await handleTelegramUpdate(update);
            return json({ ok: true, ...result });
          } catch (e) {
            console.error("[telegram-webhook]", e);
            return json({ ok: false, error: e instanceof Error ? e.message : "error" });
          }
        }
        return new Response("Method Not Allowed", { status: 405 });
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error) {
      console.error(error);
      return new Response(renderErrorPage(), { status: 500, headers: { "content-type": "text/html; charset=utf-8" } });
    }
  },
};
