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
      if (url.pathname === "/api/discord/callback" && request.method === "GET") {
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const oauthError = url.searchParams.get("error");
        const appUrl = process.env["PUBLIC_APP_URL"] || (process.env["VERCEL_PROJECT_PRODUCTION_URL"] ? "https://" + process.env["VERCEL_PROJECT_PRODUCTION_URL"] : "https://taskoraplusapp.vercel.app");
        const redirect = (q: string) => Response.redirect(appUrl.replace(/\/$/, "") + "/connected?" + q, 302);
        if (oauthError) return redirect("discord=error&message=" + encodeURIComponent("Discord authorization was cancelled."));
        if (!code || !state) return redirect("discord=error&message=" + encodeURIComponent("Discord did not return a valid connection code."));
        try {
          const { verifyDiscordOAuthState } = await import("./lib/discord-oauth.server");
          const userId = await verifyDiscordOAuthState(state);
          if (!userId) return redirect("discord=error&message=" + encodeURIComponent("Discord connection expired. Please try again."));
          const clientId = process.env["DISCORD_CLIENT_ID"];
          const clientSecret = process.env["DISCORD_CLIENT_SECRET"];
          if (!clientId || !clientSecret) return redirect("discord=error&message=" + encodeURIComponent("Discord connection is not configured on the server."));
          const redirectUri = appUrl.replace(/\/$/, "") + "/api/discord/callback";
          const tokenResponse = await fetch("https://discord.com/api/oauth2/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "authorization_code", code, redirect_uri: redirectUri }).toString() });
          const tokenBody = await tokenResponse.json() as { access_token?: string; error_description?: string };
          if (!tokenResponse.ok || !tokenBody.access_token) throw new Error(tokenBody.error_description || "Discord token exchange failed.");
          const meResponse = await fetch("https://discord.com/api/users/@me", { headers: { authorization: "Bearer " + tokenBody.access_token } });
          const me = await meResponse.json() as { id?: string; username?: string; global_name?: string; avatar?: string | null };
          if (!meResponse.ok || !me.id) throw new Error("Discord account lookup failed.");
          const { supabaseAdmin } = await import("./integrations/supabase/client.server");
          const { error } = await supabaseAdmin.from("connected_accounts").upsert({ user_id: userId, platform: "discord", handle: me.global_name || me.username || me.id, profile_url: "https://discord.com/users/" + me.id, external_id: me.id, status: "verified", verified_at: new Date().toISOString(), meta: { source: "discord_oauth", username: me.username || null, global_name: me.global_name || null, avatar: me.avatar || null } }, { onConflict: "user_id,platform" });
          if (error) throw new Error(error.message);
          return redirect("discord=connected");
        } catch (e) {
          console.error("[discord-oauth]", e);
          return redirect("discord=error&message=" + encodeURIComponent(e instanceof Error ? e.message : "Discord connection failed."));
        }
      }
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
