/** Assert profile is not wallet-frozen before withdraw. */
export async function assertWalletNotFrozen(userId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("wallet_frozen, wallet_frozen_reason")
    .eq("id", userId)
    .maybeSingle();
  if (Boolean((profile as { wallet_frozen?: boolean } | null)?.wallet_frozen)) {
    const reason =
      String((profile as { wallet_frozen_reason?: string | null } | null)?.wallet_frozen_reason ?? "").trim() ||
      "Contact support.";
    throw new Error(`Wallet is frozen by the owner. ${reason}`);
  }
}
