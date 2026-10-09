import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function getMaintenanceSwitches() {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("app_settings").select("value").eq("key", "maintenance_switches").maybeSingle();
    const v = (data?.value ?? {}) as Record<string, unknown>;
    return {
      read_only: Boolean(v.read_only),
      withdrawals_paused: Boolean(v.withdrawals_paused),
      deposits_paused: Boolean(v.deposits_paused),
      task_creation_paused: Boolean(v.task_creation_paused),
      verification_paused: Boolean(v.verification_paused),
    };
  } catch {
    return { read_only: false, withdrawals_paused: false, deposits_paused: false, task_creation_paused: false, verification_paused: false };
  }
}

export const requestDepositGuarded = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { method: string; amount: number; txHash?: string | undefined; note?: string | undefined }) => d)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const maint = await getMaintenanceSwitches();
    if (maint.read_only || maint.deposits_paused) throw new Error("Deposits are temporarily paused by the owner.");
    const amount = Number(data.amount);
    if (!(amount >= 1)) throw new Error("Minimum deposit is $1.00.");
    if (!(amount <= 50_000)) throw new Error("Maximum single deposit is $50,000.");
    const method = (data.method || "").trim();
    if (!method) throw new Error("Choose a deposit network.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin.from("profiles").select("status").eq("id", userId).maybeSingle();
    if (profile && String((profile as { status?: string }).status ?? "active") !== "active") throw new Error("Account is not allowed to deposit.");
    const { data: row, error } = await supabaseAdmin.from("deposits").insert({
      user_id: userId, amount, method, status: "pending", reference: data.txHash?.trim() || null, notes: data.note?.trim() || null,
    } as never).select("id, status, amount, method, created_at").single();
    if (error) throw new Error(error.message);
    return row;
  });
