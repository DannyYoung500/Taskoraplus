/**
 * Owner ops: system health, audit log listing, fraud flags + risk scoring + feature flags.
 * Server-only via createServerFn + assertOwner.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertOwner, audit } from "@/lib/owner-guard.server";
import { RULES, hoursSince, normalizeWalletAddress } from "@/lib/platform-rules";

export type HealthCheck = { name: string; status: "ok" | "warn" | "fail"; detail: string };

export const getSystemHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const checks: HealthCheck[] = [];
    const now = new Date().toISOString();

    try {
      const { error } = await supabaseAdmin.from("profiles").select("id", { count: "exact", head: true });
      checks.push({
        name: "Database",
        status: error ? "fail" : "ok",
        detail: error ? error.message : "Supabase reachable",
      });
    } catch (e) {
      checks.push({
        name: "Database",
        status: "fail",
        detail: e instanceof Error ? e.message : "DB error",
      });
    }

    const token = process.env["TELEGRAM_BOT_TOKEN"] ?? "";
    if (!token) {
      checks.push({ name: "Bot token", status: "fail", detail: "TELEGRAM_BOT_TOKEN missing" });
      checks.push({ name: "Webhook", status: "warn", detail: "Cannot probe without token" });
    } else {
      checks.push({ name: "Bot token", status: "ok", detail: "Configured" });
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/getWebhookInfo`);
        const j = (await res.json()) as {
          ok?: boolean;
          result?: { url?: string; pending_update_count?: number; last_error_message?: string };
        };
        const url = j.result?.url ?? "";
        const pending = j.result?.pending_update_count ?? 0;
        const lastErr = j.result?.last_error_message ?? "";
        if (!url) {
          checks.push({ name: "Webhook", status: "warn", detail: "Not registered — set in Owner → Settings" });
        } else if (lastErr) {
          checks.push({
            name: "Webhook",
            status: "fail",
            detail: `URL set · last error: ${lastErr.slice(0, 120)} · pending ${pending}`,
          });
        } else {
          checks.push({
            name: "Webhook",
            status: pending > 50 ? "warn" : "ok",
            detail: `URL set · pending updates ${pending}`,
          });
        }
      } catch (e) {
        checks.push({
          name: "Webhook",
          status: "warn",
          detail: e instanceof Error ? e.message : "Probe failed",
        });
      }
    }

    try {
      const [wd, sub, dep, fraud] = await Promise.all([
        supabaseAdmin.from("withdrawals").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabaseAdmin.from("submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabaseAdmin.from("deposits").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabaseAdmin.from("fraud_flags").select("id", { count: "exact", head: true }).eq("status", "open"),
      ]);
      checks.push({ name: "Pending withdrawals", status: (wd.count ?? 0) > 25 ? "warn" : "ok", detail: `${wd.count ?? 0} awaiting review` });
      checks.push({ name: "Pending submissions", status: (sub.count ?? 0) > 100 ? "warn" : "ok", detail: `${sub.count ?? 0} awaiting verification` });
      checks.push({ name: "Pending deposits", status: (dep.count ?? 0) > 20 ? "warn" : "ok", detail: `${dep.count ?? 0} awaiting confirmation` });
      checks.push({ name: "Open fraud flags", status: (fraud.count ?? 0) > 0 ? "warn" : "ok", detail: `${fraud.count ?? 0} open` });
    } catch (e) {
      checks.push({ name: "Queues", status: "warn", detail: e instanceof Error ? e.message : "Queue probe failed" });
    }

    try {
      const { data: econ } = await supabaseAdmin.from("app_settings").select("value").eq("key", "economy").maybeSingle();
      const v = (econ?.value ?? {}) as Record<string, unknown>;
      const minWd = Number(v.min_withdrawal_usd ?? RULES.minWithdrawalUsd);
      const paused = Boolean(v.payouts_paused);
      checks.push({
        name: "Economy",
        status: minWd < RULES.minWithdrawalUsd ? "warn" : "ok",
        detail: `Min WD $${minWd.toFixed(2)} · payouts ${paused ? "PAUSED" : "live"}`,
      });
    } catch {
      checks.push({ name: "Economy", status: "warn", detail: "Could not read economy settings" });
    }

    const hasFail = checks.some((c) => c.status === "fail");
    const hasWarn = checks.some((c) => c.status === "warn");
    return { overall: hasFail ? "fail" : hasWarn ? "warn" : "ok", checks, checkedAt: now };
  });

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string; limit?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const limit = Math.min(200, Math.max(20, Number(data?.limit ?? 80)));
    let q = supabaseAdmin
      .from("audit_logs")
      .select("id, action, admin_id, admin_label, target_type, target_id, created_at, metadata")
      .order("created_at", { ascending: false })
      .limit(limit);
    const search = (data?.search ?? "").trim();
    if (search) {
      q = q.or(`action.ilike.%${search}%,admin_label.ilike.%${search}%,target_id.ilike.%${search}%`);
    }
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export type FraudFlagRow = {
  id: string;
  user_id: string | null;
  kind: string;
  severity: string;
  status: string;
  details: string | null;
  related_id: string | null;
  created_at: string;
  display_name?: string | null;
  username?: string | null;
  telegram_id?: number | null;
  risk_score?: number;
};

export const listFraudFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }): Promise<FraudFlagRow[]> => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const status = (data?.status ?? "open").trim() || "open";
    let q = supabaseAdmin
      .from("fraud_flags")
      .select("id, user_id, kind, severity, status, details, related_id, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (status !== "all") q = q.eq("status", status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const uids = [...new Set(list.map((r) => r.user_id).filter(Boolean))] as string[];
    const nameMap = new Map<string, { display_name: string | null; username: string | null; telegram_id: number | null }>();
    if (uids.length) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, display_name, username, telegram_id")
        .in("id", uids);
      for (const p of profiles ?? []) {
        nameMap.set(p.id, {
          display_name: p.display_name ?? null,
          username: (p as { username?: string | null }).username ?? null,
          telegram_id: (p as { telegram_id?: number | null }).telegram_id ?? null,
        });
      }
    }
    return list.map((r) => {
      const n = r.user_id ? nameMap.get(r.user_id) : null;
      return {
        ...r,
        display_name: n?.display_name ?? null,
        username: n?.username ?? null,
        telegram_id: n?.telegram_id ?? null,
      };
    });
  });

export const resolveFraudFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { flagId: string; status: "resolved" | "dismissed"; note?: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin.from("fraud_flags").select("*").eq("id", data.flagId).maybeSingle();
    if (!row) throw new Error("Flag not found.");
    const { error } = await supabaseAdmin
      .from("fraud_flags")
      .update({
        status: data.status,
        investigation_note: data.note?.trim() || null,
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", data.flagId);
    if (error) throw new Error(error.message);
    await audit({
      adminId: context.userId,
      action: `fraud_${data.status}`,
      targetType: "fraud_flag",
      targetId: data.flagId,
      previous: { status: row.status },
      next: { status: data.status, note: data.note },
    }).catch(() => undefined);
    return { ok: true };
  });

export async function computeUserRiskScore(userId: string): Promise<{ score: number; signals: string[] }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const signals: string[] = [];
  let score = 0;

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("created_at, status, streak")
    .eq("id", userId)
    .maybeSingle();
  const ageH = hoursSince((profile as { created_at?: string } | null)?.created_at);
  if (ageH < 24) {
    score += 15;
    signals.push("Account < 24h old");
  } else if (ageH < 72) {
    score += 8;
    signals.push("Account < 72h old");
  }
  if (String((profile as { status?: string } | null)?.status ?? "active") !== "active") {
    score += 40;
    signals.push("Account not active");
  }

  const since24 = new Date(Date.now() - 24 * 3600_000).toISOString();
  const [{ count: sub24 }, { count: rej }, { data: wds }, { count: openFlags }] = await Promise.all([
    supabaseAdmin.from("submissions").select("id", { count: "exact", head: true }).eq("user_id", userId).gte("created_at", since24),
    supabaseAdmin.from("submissions").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "rejected"),
    supabaseAdmin.from("withdrawals").select("id, address, amount, status, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    supabaseAdmin.from("fraud_flags").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("status", "open"),
  ]);

  if ((sub24 ?? 0) >= 10) {
    score += 20;
    signals.push(`${sub24} submissions in 24h`);
  } else if ((sub24 ?? 0) >= 6) {
    score += 10;
    signals.push("Elevated submission velocity");
  }
  if ((rej ?? 0) >= 5) {
    score += 25;
    signals.push(`${rej} rejected submissions`);
  } else if ((rej ?? 0) >= 2) {
    score += 12;
    signals.push("Multiple rejected proofs");
  }
  if ((openFlags ?? 0) > 0) {
    score += 20;
    signals.push(`${openFlags} open fraud flags`);
  }

  const pendingWd = (wds ?? []).filter((w) => String(w.status) === "pending");
  if (pendingWd.length >= 2) {
    score += 15;
    signals.push("Multiple pending withdrawals");
  }
  for (const w of wds ?? []) {
    const addr = normalizeWalletAddress(String(w.address ?? ""));
    if (!addr) continue;
    const { count } = await supabaseAdmin
      .from("withdrawals")
      .select("id", { count: "exact", head: true })
      .neq("user_id", userId)
      .ilike("address", addr);
    if ((count ?? 0) > 0) {
      score += 35;
      signals.push("Shared payout address with another account");
      break;
    }
  }

  return { score: Math.min(100, score), signals };
}

export const getUserRiskScore = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    return computeUserRiskScore(data.userId);
  });

export const scanFraudSignals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let created = 0;

    const { data: recentWd } = await supabaseAdmin
      .from("withdrawals")
      .select("id, user_id, address")
      .order("created_at", { ascending: false })
      .limit(300);
    const byAddr = new Map<string, Set<string>>();
    for (const w of recentWd ?? []) {
      const a = normalizeWalletAddress(String(w.address ?? ""));
      if (!a || a.length < 8) continue;
      if (!byAddr.has(a)) byAddr.set(a, new Set());
      byAddr.get(a)!.add(String(w.user_id));
    }
    for (const [addr, users] of byAddr) {
      if (users.size < 2) continue;
      for (const uid of users) {
        const { data: existing } = await supabaseAdmin
          .from("fraud_flags")
          .select("id")
          .eq("user_id", uid)
          .eq("kind", "shared_wallet")
          .eq("status", "open")
          .maybeSingle();
        if (existing) continue;
        const { error } = await supabaseAdmin.from("fraud_flags").insert({
          user_id: uid,
          kind: "shared_wallet",
          severity: "high",
          status: "open",
          details: `Payout address shared with ${users.size - 1} other account(s): ${addr.slice(0, 12)}…`,
          related_id: addr.slice(0, 64),
        } as never);
        if (!error) created += 1;
      }
    }

    const { data: rejects } = await supabaseAdmin
      .from("submissions")
      .select("user_id")
      .eq("status", "rejected")
      .gte("created_at", new Date(Date.now() - 7 * 86400_000).toISOString())
      .limit(500);
    const rejCount = new Map<string, number>();
    for (const r of rejects ?? []) {
      const uid = String(r.user_id);
      rejCount.set(uid, (rejCount.get(uid) ?? 0) + 1);
    }
    for (const [uid, n] of rejCount) {
      if (n < 5) continue;
      const { data: existing } = await supabaseAdmin
        .from("fraud_flags")
        .select("id")
        .eq("user_id", uid)
        .eq("kind", "high_rejects")
        .eq("status", "open")
        .maybeSingle();
      if (existing) continue;
      const { error } = await supabaseAdmin.from("fraud_flags").insert({
        user_id: uid,
        kind: "high_rejects",
        severity: n >= 10 ? "high" : "medium",
        status: "open",
        details: `${n} rejected submissions in last 7 days`,
      } as never);
      if (!error) created += 1;
    }

    await audit({
      adminId: context.userId,
      action: "fraud_scan",
      targetType: "system",
      metadata: { flags_created: created },
    }).catch(() => undefined);

    return { ok: true, created };
  });

/** Feature flags + granular maintenance kill switches (app_settings). */

const DEFAULT_FLAGS: Array<{ key: string; enabled: boolean; label: string }> = [
  { key: "games_enabled", enabled: false, label: "Games hub" },
  { key: "watch_earn_enabled", enabled: true, label: "Watch & Earn" },
  { key: "advertise_enabled", enabled: true, label: "Advertise / create tasks" },
  { key: "referrals_enabled", enabled: true, label: "Invite & Earn" },
  { key: "leaderboard_enabled", enabled: true, label: "Leaderboard" },
  { key: "daily_checkin_enabled", enabled: true, label: "Daily check-in" },
];

const DEFAULT_MAINTENANCE = {
  read_only: false,
  withdrawals_paused: false,
  deposits_paused: false,
  task_creation_paused: false,
  verification_paused: false,
};

export const listFeatureFlags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: flagsRow }, { data: maintRow }] = await Promise.all([
      supabaseAdmin.from("app_settings").select("value").eq("key", "feature_flags").maybeSingle(),
      supabaseAdmin.from("app_settings").select("value").eq("key", "maintenance_switches").maybeSingle(),
    ]);

    const stored = (flagsRow?.value ?? {}) as Record<string, unknown>;
    const flags = DEFAULT_FLAGS.map((f) => ({
      key: f.key,
      label: f.label,
      enabled: typeof stored[f.key] === "boolean" ? Boolean(stored[f.key]) : f.enabled,
    }));

    for (const [k, v] of Object.entries(stored)) {
      if (!flags.some((f) => f.key === k)) {
        flags.push({ key: k, label: k, enabled: Boolean(v) });
      }
    }

    const maintStored = (maintRow?.value ?? {}) as Record<string, unknown>;
    const maintenance = {
      read_only: Boolean(maintStored.read_only ?? DEFAULT_MAINTENANCE.read_only),
      withdrawals_paused: Boolean(maintStored.withdrawals_paused ?? DEFAULT_MAINTENANCE.withdrawals_paused),
      deposits_paused: Boolean(maintStored.deposits_paused ?? DEFAULT_MAINTENANCE.deposits_paused),
      task_creation_paused: Boolean(maintStored.task_creation_paused ?? DEFAULT_MAINTENANCE.task_creation_paused),
      verification_paused: Boolean(maintStored.verification_paused ?? DEFAULT_MAINTENANCE.verification_paused),
    };

    return { flags, maintenance };
  });

export const setFeatureFlag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: string; enabled: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const key = (data.key || "").trim();
    if (!key) throw new Error("Flag key required.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "feature_flags")
      .maybeSingle();
    const prev = (row?.value ?? {}) as Record<string, unknown>;
    const next = { ...prev, [key]: Boolean(data.enabled) };

    const { error } = await supabaseAdmin.from("app_settings").upsert(
      { key: "feature_flags", value: next } as never,
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);

    await audit({
      adminId: context.userId,
      action: data.enabled ? "feature_flag.on" : "feature_flag.off",
      targetType: "feature_flag",
      targetId: key,
      previous: { [key]: prev[key] ?? null },
      next: { [key]: data.enabled },
    }).catch(() => undefined);

    return { ok: true, key, enabled: Boolean(data.enabled) };
  });

export const setMaintenanceMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      read_only?: boolean;
      withdrawals_paused?: boolean;
      deposits_paused?: boolean;
      task_creation_paused?: boolean;
      verification_paused?: boolean;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertOwner(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "maintenance_switches")
      .maybeSingle();
    const prev = (row?.value ?? {}) as Record<string, unknown>;
    const next = {
      read_only: Boolean(data.read_only ?? prev.read_only ?? false),
      withdrawals_paused: Boolean(data.withdrawals_paused ?? prev.withdrawals_paused ?? false),
      deposits_paused: Boolean(data.deposits_paused ?? prev.deposits_paused ?? false),
      task_creation_paused: Boolean(data.task_creation_paused ?? prev.task_creation_paused ?? false),
      verification_paused: Boolean(data.verification_paused ?? prev.verification_paused ?? false),
    };

    const { error } = await supabaseAdmin.from("app_settings").upsert(
      { key: "maintenance_switches", value: next } as never,
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);

    if (next.read_only) {
      await supabaseAdmin.from("app_settings").upsert(
        {
          key: "maintenance",
          value: { enabled: true, message: "Platform is in read-only maintenance mode." },
        } as never,
        { onConflict: "key" },
      );
    } else {
      const { data: globalMaint } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "maintenance")
        .maybeSingle();
      const gv = (globalMaint?.value ?? {}) as { enabled?: boolean; message?: string };
      if (gv.enabled && gv.message?.includes("read-only")) {
        await supabaseAdmin.from("app_settings").upsert(
          { key: "maintenance", value: { enabled: false, message: gv.message ?? "" } } as never,
          { onConflict: "key" },
        );
      }
    }

    await audit({
      adminId: context.userId,
      action: "maintenance_switches.update",
      targetType: "settings",
      targetId: "maintenance_switches",
      previous: prev,
      next,
    }).catch(() => undefined);

    return { ok: true, maintenance: next };
  });
