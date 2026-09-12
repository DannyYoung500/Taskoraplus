import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnerTelegramId } from "@/lib/owner";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (isAdmin) return;
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("telegram_id")
    .eq("id", userId)
    .maybeSingle();
  const tg = (profile as { telegram_id?: number | null } | null)?.telegram_id;
  if (isOwnerTelegramId(tg ?? null)) {
    await supabaseAdmin.from("user_roles").upsert(
      { user_id: userId, role: "admin" } as never,
      { onConflict: "user_id,role" } as never,
    );
    return;
  }
  throw new Error("Owner/admin authorization required.");
}

export const listPendingWithdrawals = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("withdrawals")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const reviewWithdrawal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { withdrawalId: string; decision: "paid" | "rejected" }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("withdrawals")
      .select("*")
      .eq("id", data.withdrawalId)
      .maybeSingle();
    if (!row) throw new Error("Withdrawal not found.");
    if (row.status !== "pending") throw new Error(`Already ${row.status}.`);

    if (data.decision === "rejected") {
      // Refund ledger amount that was deducted at request time
      await supabaseAdmin.from("transactions").insert({
        user_id: row.user_id,
        label: "Withdrawal rejected — refund",
        amount: Math.abs(Number(row.amount)),
        kind: "bonus",
      });
    }

    const { error } = await supabaseAdmin
      .from("withdrawals")
      .update({ status: data.decision })
      .eq("id", data.withdrawalId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    return { status: data.decision };
  });
