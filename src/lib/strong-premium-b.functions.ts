/** Premium strong B: WD SLA, referral fraud, ad session, kill-switches */
import { createServerFn } from "@tanstack/react-start";
import { createHash, randomBytes } from "node:crypto";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
async function assertAdmin(userId: string) {
  const { assertOwner } = await import("@/lib/owner-guard.server");
  await assertOwner(userId);
}
function ipFamily(ip: string): string {
  const t = ip.trim();
  if (!t) return "";
  if (t.includes(".")) return t.split(".").slice(0, 3).join(".");
  if (t.includes(":")) return t.split(":").slice(0, 4).join(":");
  return t.slice(0, 12);
}

/* ───────── 6 · Stuck withdrawal SLA ───────── */
export async function runStuckWithdrawalSla(opts?: {
  hours?: number;
}): Promise<{ count: number; totalUsd: number; flagged: number }> {
  const hours = Math.max(4, Math.min(72, Number(opts?.hours ?? 12)));
  const s = await admin();
  const cutoff = new Date(Date.now() - hours * 3600_000).toISOString();
  const { data: rows } = await s
    .from("withdrawals")
    .select("id, amount, method, created_at, user_id, status")
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(40);

  const list = rows ?? [];
  const totalUsd = list.reduce((sum, r) => sum + Number((r as { amount?: number }).amount || 0), 0);
  let flagged = 0;

  for (const r of list.slice(0, 15)) {
    try {
      await s
        .from("withdrawals")
        .update({
          ops_note: `stuck_sla_${hours}h`,
          updated_at: new Date().toISOString(),
        } as never)
        .eq("id", (r as { id: string }).id)
        .eq("status", "pending");
      flagged += 1;
    } catch {
      /* column may not exist */
    }
  }

  if (list.length > 0) {
    try {
      const { sendOwnerHtml } = await import("@/lib/notify-owner");
      const lines = list
        .slice(0, 12)
        .map((r) => {
          const ageH = Math.round(
            (Date.now() - new Date(String((r as { created_at: string }).created_at)).getTime()) /
              3600000,
          );
          return `• $${Number((r as { amount?: number }).amount).toFixed(2)} ${(r as { method?: string }).method} · ${ageH}h · <code>${String((r as { id: string }).id).slice(0, 8)}</code>`;
        })
        .join("\n");
      await sendOwnerHtml(
        `⏰ <b>Stuck withdrawals (≥${hours}h)</b>\n${list.length} pending · ~$${totalUsd.toFixed(2)}\n${lines}`,
      );
    } catch {
      /* soft */
    }
  }

  return { count: list.length, totalUsd, flagged };
}

export const ownerRunStuckWithdrawalSla = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d?: { hours?: number }) => d ?? {})
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    return runStuckWithdrawalSla({ hours: Number((data as { hours?: number })?.hours ?? 12) });
  });

/* ───────── 8 · Referral fraud gate ───────── */
export async function assertReferralFraudGate(opts: {
  inviterId: string;
  refereeUserId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  if (!opts.inviterId || !opts.refereeUserId || opts.inviterId === opts.refereeUserId) {
    return { ok: false, reason: "invalid_pair" };
  }
  try {
    const s = await admin();
    const { data: profiles } = await s
      .from("profiles")
      .select("id, device_fp, last_ip_hint")
      .in("id", [opts.inviterId, opts.refereeUserId]);

    const inv = (profiles ?? []).find((p) => p.id === opts.inviterId) as
      | { device_fp?: string; last_ip_hint?: string }
      | undefined;
    const ref = (profiles ?? []).find((p) => p.id === opts.refereeUserId) as
      | { device_fp?: string; last_ip_hint?: string }
      | undefined;

    const invFp = String(inv?.device_fp || "");
    const refFp = String(ref?.device_fp || "");
    if (invFp.length >= 8 && refFp.length >= 8 && invFp === refFp) {
      return { ok: false, reason: "same_device_fp" };
    }

    const invFam = ipFamily(inv?.last_ip_hint || "");
    const refFam = ipFamily(ref?.last_ip_hint || "");
    if (invFam.length >= 4 && refFam.length >= 4 && invFam === refFam) {
      return { ok: false, reason: "same_ip_family" };
    }

    const { data: wds } = await s
      .from("withdrawals")
      .select("user_id, address")
      .in("user_id", [opts.inviterId, opts.refereeUserId])
      .in("status", ["paid", "completed", "processing", "pending"])
      .limit(40);
    const invAddrs = new Set(
      (wds ?? [])
        .filter((w) => w.user_id === opts.inviterId)
        .map((w) => String((w as { address?: string }).address || "").trim().toLowerCase())
        .filter((a) => a.length >= 10),
    );
    for (const w of wds ?? []) {
      if (w.user_id !== opts.refereeUserId) continue;
      const a = String((w as { address?: string }).address || "").trim().toLowerCase();
      if (a.length >= 10 && invAddrs.has(a)) {
        return { ok: false, reason: "same_payout_address" };
      }
    }

    return { ok: true };
  } catch {
    return { ok: false, reason: "gate_error" };
  }
}

/* ───────── 9 · Bonus-ad SDK session token ───────── */
export async function mintBonusAdSession(opts: {
  userId: string;
}): Promise<{ token: string; expiresAt: string }> {
  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
  try {
    const s = await admin();
    await s.from("app_settings").upsert(
      {
        key: `bonus_ad_session:${opts.userId}`,
        value: { token, expiresAt, used: false },
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "key" },
    );
  } catch {
    /* soft */
  }
  return { token, expiresAt };
}

export const getBonusAdSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return mintBonusAdSession({ userId: context.userId });
  });

export async function assertBonusAdSessionToken(opts: {
  userId: string;
  sdkToken?: string | null;
}): Promise<void> {
  const token = String(opts.sdkToken || "").trim();
  if (!token) return;

  try {
    const s = await admin();
    const { data } = await s
      .from("app_settings")
      .select("value")
      .eq("key", `bonus_ad_session:${opts.userId}`)
      .maybeSingle();
    const v = (data?.value ?? {}) as {
      token?: string;
      expiresAt?: string;
      used?: boolean;
    };
    if (!v.token || v.token !== token) {
      throw new Error("Invalid bonus-ad session. Open the ad again.");
    }
    if (v.used) {
      throw new Error("This bonus-ad session was already claimed.");
    }
    if (v.expiresAt && new Date(v.expiresAt).getTime() < Date.now()) {
      throw new Error("Bonus-ad session expired. Open the ad again.");
    }
    await s.from("app_settings").upsert(
      {
        key: `bonus_ad_session:${opts.userId}`,
        value: { ...v, used: true },
        updated_at: new Date().toISOString(),
      } as never,
      { onConflict: "key" },
    );
  } catch (e) {
    if (
      e instanceof Error &&
      (e.message.includes("bonus-ad") || e.message.includes("session") || e.message.includes("Invalid"))
    ) {
      throw e;
    }
  }
}

/* ───────── 10 · Kill-switch helpers ───────── */
export type KillSwitches = {
  read_only: boolean;
  withdrawals_paused: boolean;
  deposits_paused: boolean;
  task_creation_paused: boolean;
  verification_paused: boolean;
  watches_paused: boolean;
};

export async function getMaintenanceSwitchesPremium(): Promise<KillSwitches> {
  try {
    const s = await admin();
    const { data } = await s
      .from("app_settings")
      .select("value")
      .eq("key", "maintenance_switches")
      .maybeSingle();
    const v = (data?.value ?? {}) as Record<string, unknown>;
    return {
      read_only: Boolean(v.read_only),
      withdrawals_paused: Boolean(v.withdrawals_paused),
      deposits_paused: Boolean(v.deposits_paused),
      task_creation_paused: Boolean(v.task_creation_paused),
      verification_paused: Boolean(v.verification_paused),
      watches_paused: Boolean(v.watches_paused),
    };
  } catch {
    return {
      read_only: false,
      withdrawals_paused: false,
      deposits_paused: false,
      task_creation_paused: false,
      verification_paused: false,
      watches_paused: false,
    };
  }
}

export async function assertNotPaused(
  keys: Array<keyof KillSwitches>,
  message?: string,
): Promise<void> {
  const sw = await getMaintenanceSwitchesPremium();
  for (const k of keys) {
    if (sw[k] || sw.read_only) {
      throw new Error(
        message ||
          (k === "withdrawals_paused"
            ? "Withdrawals are temporarily paused by the owner."
            : k === "watches_paused"
              ? "Watch & Earn is temporarily paused by the owner."
              : k === "task_creation_paused"
                ? "Task creation is temporarily paused by the owner."
                : k === "verification_paused"
                  ? "Verification is temporarily paused by the owner."
                  : "Platform is in read-only mode. Try again later."),
      );
    }
  }
}
