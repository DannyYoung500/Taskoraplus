import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  notifyOwnersWithdrawalRequested,
  notifyOwnersNewUser,
} from "@/lib/notify-owner";

/** Owner-only: send a sample withdrawal notification to owner Telegram IDs. */
export const ownerTestWithdrawalNotify = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { isOwnerTelegramId } = await import("@/lib/owner");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("telegram_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (!isOwnerTelegramId(profile?.telegram_id ?? null)) {
      throw new Error("Owner only.");
    }
    await notifyOwnersWithdrawalRequested({
      userId: context.userId,
      displayName: "TEST USER (owner test)",
      amount: 1.25,
      method: "USDT-TRC20",
      address: "TTestWalletAddressForNotifyCheck123",
      reference: `test-${Date.now().toString(36)}`,
    });
    return { ok: true as const };
  });

/** Owner-only: send a sample new-user notification to owner Telegram IDs. */
export const ownerTestNewUserNotify = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { isOwnerTelegramId } = await import("@/lib/owner");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("telegram_id")
      .eq("id", context.userId)
      .maybeSingle();
    if (!isOwnerTelegramId(profile?.telegram_id ?? null)) {
      throw new Error("Owner only.");
    }
    await notifyOwnersNewUser({
      displayName: "TEST NEW USER",
      username: "test_user",
      telegramId: Number(profile?.telegram_id) || 0,
    });
    return { ok: true as const };
  });
