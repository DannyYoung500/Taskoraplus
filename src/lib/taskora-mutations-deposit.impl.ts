import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CRYPTO_METHODS = ["USDT · TRC20", "USDT · BEP20", "USDT · ERC20", "TON", "BTC", "ETH", "BNB · BEP20"] as const;

function validTransactionHash(method: string, hash: string): boolean {
  const value = hash.trim();
  if (method === "TON") return /^[A-Za-z0-9_-]{32,128}$/.test(value);
  return /^(?:0x)?[a-fA-F0-9]{64}$/.test(value);
}

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
    if (!Number.isFinite(amount) || !(amount >= 1)) throw new Error("Minimum deposit is $1.00.");
    if (!(amount <= 50_000)) throw new Error("Maximum single deposit is $50,000.");
    const method = String(data.method ?? "").trim();
    if (!(CRYPTO_METHODS as readonly string[]).includes(method)) throw new Error("Choose a supported cryptocurrency network.");
    const txHash = String(data.txHash ?? "").trim();
    if (!txHash) throw new Error("Submit the on-chain transaction hash after sending your crypto.");
    if (!validTransactionHash(method, txHash)) throw new Error("The transaction hash format does not match the selected network.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Never accept a deposit for a network without a configured receive address.
    const { data: economyRow, error: economyError } = await supabaseAdmin
      .from("app_settings").select("value").eq("key", "economy").maybeSingle();
    if (economyError) throw new Error("Could not verify deposit network configuration. Try again.");
    const economy = (economyRow?.value ?? {}) as { deposit_addresses?: Array<{ id?: string; method?: string; network?: string; address?: string }> };
    const configuredAddresses = Array.isArray(economy.deposit_addresses) ? economy.deposit_addresses : [];
    const networkHint = method.includes("TRC20") ? "TRC20" : method.includes("BEP20") ? "BEP20" : method.includes("ERC20") ? "ERC20" : method;
    const configured = configuredAddresses.find((item) => String(item.id ?? "") === method) ??
      configuredAddresses.find((item) => {
        const asset = String(item.method ?? "").toUpperCase();
        const network = String(item.network ?? "").toUpperCase();
        const wantedAsset = method.startsWith("USDT") ? "USDT" : method.startsWith("BNB") ? "BNB" : method;
        return asset === wantedAsset && (network.includes(networkHint) || (method === "ETH" && network.includes("ERC20")));
      });
    if (!String(configured?.address ?? "").trim()) {
      throw new Error("This crypto network is not configured for deposits yet. Do not send funds.");
    }

    // A transaction hash must not be submitted against multiple deposit requests.
    const { data: duplicate, error: duplicateError } = await supabaseAdmin
      .from("deposits").select("id").eq("reference", txHash).limit(1).maybeSingle();
    if (duplicateError) throw new Error("Could not check whether this transaction was already submitted.");
    if (duplicate) throw new Error("This transaction hash has already been submitted.");

    const { data: profile } = await supabaseAdmin.from("profiles").select("status").eq("id", userId).maybeSingle();
    if (profile && String((profile as { status?: string }).status ?? "active") !== "active") throw new Error("Account is not allowed to deposit.");
    const { data: row, error } = await supabaseAdmin.from("deposits").insert({
      user_id: userId, amount, method, status: "pending", reference: txHash, notes: data.note?.trim() || null,
    } as never).select("id, status, amount, method, created_at").single();
    if (error) throw new Error(error.message);
    return row;
  });
