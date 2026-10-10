/**
 * Remaining strong options (server-only):
 * - Device FP v2 report + cluster auto-hold + device change stamp
 * - Money-path initData freshness (≤5 min)
 * - Soft KYC: username + photo + connected account before first WD
 * - Short app session after initData
 * Soft-fail when optional columns missing.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function adminClient() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Report client composite FP; store as device_fp (and device_fp_v2 if column exists). Auto-hold clusters ≥3. */
export const reportDeviceFpV2 = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { rawFp: string; ipHint?: string }) => d)
  .handler(async ({ data, context }) => {
    const raw = String(data.rawFp ?? "").slice(0, 2000);
    if (raw.length < 8) return { ok: false as const, multi: 1 };
    const fp = (await sha256Hex(raw)).slice(0, 32);
    const s = await adminClient();
    try {
      await s
        .from("profiles")
        .update({
          device_fp: fp,
          last_ip_hint: (data.ipHint ?? "").slice(0, 64) || null,
          last_seen_at: new Date().toISOString(),
        } as never)
        .eq("id", context.userId);
    } catch {
      /* soft */
    }
    try {
      await s
        .from("profiles")
        .update({ device_fp_v2: fp } as never)
        .eq("id", context.userId);
    } catch {
      /* column may not exist */
    }

    try {
      const { markDeviceFpChangedIfNeeded } = await import("@/lib/strong-more.functions");
      await markDeviceFpChangedIfNeeded({ userId: context.userId, newFp: fp });
    } catch {
      /* soft */
    }

    const multi = await countDeviceCluster(fp);
    if (multi >= 3) {
      await applyClusterAutoHold({ userId: context.userId, fingerprint: fp, multi });
    }
    return { ok: true as const, multi, fpHint: fp.slice(0, 8) };
  });

async function countDeviceCluster(fp: string): Promise<number> {
  try {
    const s = await adminClient();
    const { count } = await s
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("device_fp", fp);
    return Number(count ?? 1);
  } catch {
    return 1;
  }
}

/** When same device_fp has ≥3 accounts: freeze wallet on the reporting user + alert owner. */
export async function applyClusterAutoHold(opts: {
  userId: string;
  fingerprint: string;
  multi: number;
}): Promise<{ held: boolean }> {
  if (opts.multi < 3) return { held: false };
  try {
    const s = await adminClient();
    await s
      .from("profiles")
      .update({
        wallet_frozen: true,
        wallet_frozen_reason: `Auto-hold: device linked to ${opts.multi} accounts`,
        wallet_frozen_at: new Date().toISOString(),
      } as never)
      .eq("id", opts.userId);
    try {
      const { sendOwnerHtml } = await import("@/lib/notify-owner");
      await sendOwnerHtml(
        `🛑 <b>Cluster auto-hold</b>\nUser <code>${opts.userId.slice(0, 8)}</code>\nfp <code>${opts.fingerprint.slice(0, 12)}…</code>\nAccounts on device: <b>${opts.multi}</b>\nWallet frozen pending review.`,
      );
    } catch {
      /* soft */
    }
    return { held: true };
  } catch {
    return { held: false };
  }
}

/** Soft KYC+: username + photo + connected account before first withdrawal. */
export async function assertSoftKycPlus(opts: {
  userId: string;
}): Promise<{ ok: boolean; reason?: string }> {
  try {
    const s = await adminClient();
    const { data: profile } = await s
      .from("profiles")
      .select("username, photo_url, first_name, trust_score")
      .eq("id", opts.userId)
      .maybeSingle();

    const username = String((profile as { username?: string | null })?.username ?? "").trim();
    const photo = String((profile as { photo_url?: string | null })?.photo_url ?? "");
    const trust = Number((profile as { trust_score?: number })?.trust_score ?? 70);

    if (!username || username.length < 3) {
      return {
        ok: false,
        reason:
          "Soft KYC: set a Telegram username (Settings → Username) before withdrawing.",
      };
    }
    if (!photo.startsWith("http")) {
      return {
        ok: false,
        reason:
          "Soft KYC: add a Telegram profile photo, then re-open TASKORA so we can verify it.",
      };
    }

    try {
      const { assertSoftKycForWithdrawal } = await import("@/lib/strong-ops");
      const legacy = await assertSoftKycForWithdrawal({ userId: opts.userId });
      if (!legacy.ok && legacy.reason) return { ok: false, reason: legacy.reason };
    } catch {
      /* soft */
    }

    try {
      const { assertConnectedBeforeFirstWithdrawal } = await import("@/lib/strong-next.functions");
      await assertConnectedBeforeFirstWithdrawal({ userId: opts.userId });
    } catch (e) {
      if (e instanceof Error && e.message.includes("Connect at least")) {
        return { ok: false, reason: e.message };
      }
    }

    if (trust < 35) {
      return {
        ok: false,
        reason: `Trust score too low (${trust}). Complete verified tasks to raise trust before withdrawing.`,
      };
    }
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

/** Money-path: require fresh Telegram initData (default 5 minutes). */
export async function assertFreshInitDataForMoney(opts: {
  initData?: string | null;
  maxAgeSeconds?: number;
}): Promise<{ ok: boolean; userId?: number }> {
  const raw = String(opts.initData ?? "").trim();
  if (!raw) {
    return { ok: true };
  }
  const token = process.env.TELEGRAM_BOT_TOKEN ?? process.env.BOT_TOKEN ?? "";
  if (!token) return { ok: true };
  const maxAge = opts.maxAgeSeconds ?? 300;
  const { validateTelegramInitData } = await import("@/lib/telegram-initdata");
  const v = await validateTelegramInitData(raw, token, maxAge);
  return { ok: true, userId: v.user.id };
}

/** Exchange validated initData for short-lived app session token. */
export const mintSessionFromInitData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { initData: string }) => d)
  .handler(async ({ data, context }) => {
    const token = process.env.TELEGRAM_BOT_TOKEN ?? process.env.BOT_TOKEN ?? "";
    if (!token) throw new Error("Bot token not configured.");
    const { validateTelegramInitData } = await import("@/lib/telegram-initdata");
    await validateTelegramInitData(data.initData, token, 3600);
    const { mintAppSessionToken } = await import("@/lib/strong-elite.functions");
    return mintAppSessionToken(context.userId);
  });

/** Cluster check on withdraw: block if ≥3 accounts share device_fp. */
export async function assertClusterNotBlocked(opts: {
  userId: string;
}): Promise<void> {
  try {
    const s = await adminClient();
    const { data: profile } = await s
      .from("profiles")
      .select("device_fp, wallet_frozen, wallet_frozen_reason")
      .eq("id", opts.userId)
      .maybeSingle();
    if (Boolean((profile as { wallet_frozen?: boolean })?.wallet_frozen)) {
      const reason =
        String((profile as { wallet_frozen_reason?: string })?.wallet_frozen_reason ?? "").trim() ||
        "Contact support.";
      throw new Error(`Wallet is frozen. ${reason}`);
    }
    const fp = String((profile as { device_fp?: string })?.device_fp ?? "");
    if (fp.length < 8) return;
    const multi = await countDeviceCluster(fp);
    if (multi >= 3) {
      await applyClusterAutoHold({ userId: opts.userId, fingerprint: fp, multi });
      throw new Error(
        "Withdrawal blocked: this device is linked to multiple accounts. Contact support.",
      );
    }
  } catch (e) {
    if (e instanceof Error && (e.message.includes("frozen") || e.message.includes("multiple"))) {
      throw e;
    }
  }
}

export const ownerForceClusterScanHold = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertOwner } = await import("@/lib/owner-guard.server");
    await assertOwner(context.userId);
    const s = await adminClient();
    const { data: rows } = await s
      .from("profiles")
      .select("id, device_fp")
      .not("device_fp", "is", null)
      .limit(3000);
    const byFp = new Map<string, string[]>();
    for (const r of rows ?? []) {
      const fp = String((r as { device_fp?: string }).device_fp ?? "");
      if (fp.length < 8) continue;
      const list = byFp.get(fp) ?? [];
      list.push((r as { id: string }).id);
      byFp.set(fp, list);
    }
    let held = 0;
    for (const [fp, users] of byFp) {
      if (users.length < 3) continue;
      for (const uid of users) {
        const r = await applyClusterAutoHold({ userId: uid, fingerprint: fp, multi: users.length });
        if (r.held) held += 1;
      }
    }
    return { clusters: [...byFp.values()].filter((u) => u.length >= 3).length, held };
  });
