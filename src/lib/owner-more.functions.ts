import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function guard(userId: string) {
  const { assertOwner, admin } = await import("@/lib/owner-guard.server");
  await assertOwner(userId);
  return admin();
}

async function audit(
  adminId: string,
  action: string,
  rest: { targetType?: string; targetId?: string; previous?: unknown; next?: unknown } = {},
) {
  const { audit: a } = await import("@/lib/owner-guard.server");
  await a({ adminId, action, ...rest });
}

export const ownerListCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await guard(context.userId);
    const { data, error } = await db
      .from("campaigns")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      // table may be empty / missing columns
      return { campaigns: [], error: error.message };
    }
    return { campaigns: data ?? [], error: null as string | null };
  });

export const ownerSetCampaignStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: string }) => d)
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    const allowed = ["draft", "active", "paused", "completed", "terminated", "pending"];
    if (!allowed.includes(data.status)) throw new Error("Invalid campaign status.");
    const { data: prev } = await db.from("campaigns").select("status").eq("id", data.id).maybeSingle();
    const { error } = await db.from("campaigns").update({ status: data.status as never }).eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context.userId, `campaign.${data.status}`, {
      targetType: "campaign",
      targetId: data.id,
      previous: prev?.status,
      next: data.status,
    });
    return { ok: true };
  });

export const ownerListDeposits = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const db = await guard(context.userId);
    try {
      const { data, error } = await db
        .from("deposits")
        .select("*, profiles:user_id(display_name, username, telegram_id)")
        .order("created_at", { ascending: false })
        .limit(150);
      if (error) return { deposits: [], error: error.message };
      return { deposits: data ?? [], error: null as string | null };
    } catch (e) {
      return { deposits: [], error: e instanceof Error ? e.message : "deposits unavailable" };
    }
  });

export const ownerListLedger = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId?: string; limit?: number }) => d)
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    const limit = Math.min(200, data.limit ?? 80);
    try {
      let q = (db as any)
        .from("ledger_entries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (data.userId) q = q.eq("user_id", data.userId);
      const { data: rows, error } = await q;
      if (error) {
        // Fallback: show transactions as ledger-like rows
        const { data: txs } = await db
          .from("transactions")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(limit);
        return {
          source: "transactions" as const,
          rows: (txs ?? []).map((t) => ({
            id: t.id,
            user_id: t.user_id,
            entry_type: t.kind,
            debit: Number(t.amount) < 0 ? Math.abs(Number(t.amount)) : 0,
            credit: Number(t.amount) > 0 ? Number(t.amount) : 0,
            reference: t.label,
            created_at: t.created_at,
          })),
        };
      }
      return { source: "ledger" as const, rows: rows ?? [] };
    } catch {
      const { data: txs } = await db
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
      return {
        source: "transactions" as const,
        rows: (txs ?? []).map((t) => ({
          id: t.id,
          user_id: t.user_id,
          entry_type: t.kind,
          debit: Number(t.amount) < 0 ? Math.abs(Number(t.amount)) : 0,
          credit: Number(t.amount) > 0 ? Number(t.amount) : 0,
          reference: t.label,
          created_at: t.created_at,
        })),
      };
    }
  });

export const ownerListConnectedAccounts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string }) => d)
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    try {
      let q = (db as any)
        .from("connected_accounts")
        .select("*, profiles:user_id(display_name, username, telegram_id)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (data.status && data.status !== "all") q = q.eq("status", data.status);
      const { data: rows, error } = await q;
      if (error) return { accounts: [], error: error.message };
      return { accounts: rows ?? [], error: null as string | null };
    } catch (e) {
      return { accounts: [], error: e instanceof Error ? e.message : "unavailable" };
    }
  });

export const ownerSetConnectedStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string; status: "verified" | "rejected" | "pending" | "revoked" }) => d)
  .handler(async ({ data, context }) => {
    const db = await guard(context.userId);
    const { data: prev } = await (db as any)
      .from("connected_accounts")
      .select("status")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await (db as any)
      .from("connected_accounts")
      .update({
        status: data.status,
        verified_at: data.status === "verified" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await audit(context.userId, `connected.${data.status}`, {
      targetType: "connected_account",
      targetId: data.id,
      previous: prev?.status,
      next: data.status,
    });
    return { ok: true };
  });

export const ownerSetStaffPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; permission: string }) => d)
  .handler(async ({ data, context }) => { const db=await guard(context.userId); if(!data.userId||!data.permission) throw new Error("User and permission are required."); const {error}=await (db as any).from("staff_permissions").upsert({user_id:data.userId,permission:data.permission,granted_by:context.userId},{onConflict:"user_id,permission"}); if(error) throw new Error(error.message); await audit(context.userId,"staff.permission_grant",{targetType:"staff_permission",targetId:data.userId,next:data.permission}); return {ok:true}; });

export const ownerRemoveStaffPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; permission: string }) => d)
  .handler(async ({ data, context }) => { const db=await guard(context.userId); const {error}=await (db as any).from("staff_permissions").delete().eq("user_id",data.userId).eq("permission",data.permission); if(error) throw new Error(error.message); await audit(context.userId,"staff.permission_revoke",{targetType:"staff_permission",targetId:data.userId,next:data.permission}); return {ok:true}; });

export const ownerListStaffPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => { const db=await guard(context.userId); const {data:roles,error:roleError}=await db.from("user_roles").select("user_id, role"); const {data:permissions,error:permissionError}=await (db as any).from("staff_permissions").select("user_id, permission, granted_by, created_at"); if(roleError)throw new Error(roleError.message); if(permissionError)throw new Error(permissionError.message); return {roles:roles??[],permissions:permissions??[],catalog:["view_users","edit_users","suspend","view_wallet","approve_withdrawal","reject_withdrawal","adjust_balance","manage_tasks","moderate_proofs","manage_campaigns","change_economy","manage_fraud","manage_telegram_gate","view_audit","manage_roles"]}; });
