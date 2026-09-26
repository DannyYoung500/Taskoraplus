import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { validateTelegramInitData } from "@/lib/telegram-initdata";
import {
  telegramDerivedPassword,
  telegramSyntheticEmail,
} from "@/lib/telegram-auth-bridge";
import { isOwnerTelegramId } from "@/lib/owner";
import { notifyOwnersNewUser } from "@/lib/notify-owner";

export type TaskRow = Database["public"]["Tables"]["tasks"]["Row"];

export const loginWithTelegram = createServerFn({ method: "POST" })
  .inputValidator((d: { initData: string }) => d)
  .handler(async ({ data }) => {
    const botToken = process.env["TELEGRAM_BOT_TOKEN"] ?? "";
    const validated = await validateTelegramInitData(data.initData, botToken);
    const telegramId = validated.user.id;
    let isNewUser = false;
    const email = telegramSyntheticEmail(telegramId);
    const password = await telegramDerivedPassword(telegramId);
    const displayName =
      [validated.user.first_name, validated.user.last_name].filter(Boolean).join(" ") ||
      validated.user.username ||
      `User ${telegramId}`;
    const photoUrl = validated.user.photo_url ?? null;
    const languageCode = validated.user.language_code?.trim().toLowerCase() || null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { countryFromRequestHeaders, resolveCountryFromLanguage } = await import(
      "@/lib/locale-geo"
    );

    let edgeCountry: { code: string | null; name: string | null } = { code: null, name: null };
    try {
      const { getRequest } = await import("@tanstack/react-start/server");
      edgeCountry = countryFromRequestHeaders(getRequest()?.headers);
    } catch {
      /* headers unavailable outside request context */
    }
    const langCountry = resolveCountryFromLanguage(languageCode);
    const countryCode = edgeCountry.code || langCountry.code || null;
    const countryName = edgeCountry.name || langCountry.name || null;

    let userId: string | undefined;
    const { data: listed } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const match =
      listed?.users?.find((u) => Number(u.user_metadata?.telegram_id) === telegramId) ??
      listed?.users?.find((u) => u.email === email);
    userId = match?.id;

    if (!userId) {
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          telegram_id: telegramId,
          username: validated.user.username ?? null,
          display_name: displayName,
          photo_url: photoUrl,
          auth_provider: "telegram",
        },
      });
      if (createErr || !created.user) {
        const { data: again } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        userId =
          again?.users?.find((u) => Number(u.user_metadata?.telegram_id) === telegramId)?.id ??
          again?.users?.find((u) => u.email === email)?.id;
        if (!userId) throw new Error(createErr?.message ?? "Could not create Telegram user.");
      } else {
        userId = created.user.id;
        isNewUser = true;
      }
    } else {
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password,
        user_metadata: {
          telegram_id: telegramId,
          username: validated.user.username ?? null,
          display_name: displayName,
          photo_url: photoUrl,
          auth_provider: "telegram",
        },
      });
    }

    const referralCode = `TASKORA-${String(telegramId).slice(-6).toUpperCase()}`;
    const nowIso = new Date().toISOString();
    await supabaseAdmin.from("profiles").upsert(
      {
        id: userId,
        display_name: displayName,
        username: validated.user.username ?? null,
        referral_code: referralCode,
        ...({
          telegram_id: telegramId,
          photo_url: photoUrl,
          last_active_at: nowIso,
          language_code: languageCode,
          ...(countryCode ? { country_code: countryCode } : {}),
          ...(countryName ? { country: countryName } : {}),
        } as Record<string, unknown>),
      } as never,
      { onConflict: "id" },
    );

    const owner = isOwnerTelegramId(telegramId);
    if (owner) {
      await supabaseAdmin.from("user_roles").upsert(
        { user_id: userId, role: "admin" } as never,
        { onConflict: "user_id,role" } as never,
      );
    }

    if (isNewUser && !owner) {
      await notifyOwnersNewUser({
        displayName,
        username: validated.user.username ?? null,
        telegramId,
      });
    }

    const url = process.env["SUPABASE_URL"] ?? "https://qvwetjpgplkhxuymsnyx.supabase.co";
    const anon = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const authClient = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: sessionData, error: signErr } = await authClient.auth.signInWithPassword({
      email,
      password,
    });
    if (signErr || !sessionData.session) {
      throw new Error(signErr?.message ?? "Could not issue Telegram session.");
    }

    return {
      sessionReady: true as const,
      telegramId,
      userId,
      isOwner: owner,
      access_token: sessionData.session.access_token,
      refresh_token: sessionData.session.refresh_token,
      expires_at: sessionData.session.expires_at ?? null,
      username: validated.user.username ?? null,
      firstName: validated.user.first_name ?? null,
      photoUrl,
      startParam: validated.startParam ?? null,
    };
  });

export const validateTelegramSession = loginWithTelegram;

// Primary data APIs (full implementations)
export * from "@/lib/taskora-rest.functions";
// Referral / withdrawal helpers
export * from "@/lib/taskora-extra2.functions";
// Daily check-in with streak bonus
export { dailyCheckin } from "@/lib/taskora-extra.functions";
