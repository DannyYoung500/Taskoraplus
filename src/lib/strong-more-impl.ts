/**
 * Strong more - server helpers (no .server path).
 */
async function admin() {
  const { supabaseAdmin } = await import("@/lib/supabase-admin-impl");
  return supabaseAdmin;
}

export async function getOwnerRiskHeatmapInternal() {
  try {
    const s = await admin();
    const { data: rows } = await s
      .from("profiles")
      .select("id, device_fp, last_ip_hint, country_code, wallet_frozen")
      .limit(2000);
    const byFp = new Map();
    const byIp = new Map();
    const byCc = new Map();
    for (const r of rows ?? []) {
      const fp = String((r as any).device_fp ?? "").trim();
      const ip = String((r as any).last_ip_hint ?? "").trim();
      const cc = String((r as any).country_code ?? "").trim().toUpperCase();
      const frozen = Boolean((r as any).wallet_frozen);
      const id = String((r as any).id);
      if (fp.length >= 8) {
        const cur = byFp.get(fp) ?? { count: 0, frozen: 0, sampleIds: [] };
        cur.count += 1;
        if (frozen) cur.frozen += 1;
        if (cur.sampleIds.length < 5) cur.sampleIds.push(id);
        byFp.set(fp, cur);
      }
      if (ip.length >= 4) {
        const cur = byIp.get(ip) ?? { count: 0, frozen: 0, sampleIds: [] };
        cur.count += 1;
        if (frozen) cur.frozen += 1;
        if (cur.sampleIds.length < 5) cur.sampleIds.push(id);
        byIp.set(ip, cur);
      }
      if (cc) {
        const cur = byCc.get(cc) ?? { count: 0, frozen: 0 };
        cur.count += 1;
        if (frozen) cur.frozen += 1;
        byCc.set(cc, cur);
      }
    }
    const topFp = [...byFp.entries()]
      .filter(([, v]) => v.count >= 2)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 25)
      .map(([fp, v]) => ({ key: fp.slice(0, 10) + "...", count: v.count, frozen: v.frozen, sampleIds: v.sampleIds }));
    const topIp = [...byIp.entries()]
      .filter(([, v]) => v.count >= 2)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 25)
      .map(([ip, v]) => ({ key: ip.length > 20 ? ip.slice(0, 16) + "..." : ip, count: v.count, frozen: v.frozen, sampleIds: v.sampleIds }));
    const topCc = [...byCc.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 20)
      .map(([cc, v]) => ({ key: cc, count: v.count, frozen: v.frozen }));
    return {
      profilesScanned: (rows ?? []).length,
      topFp,
      topIp,
      topCc,
      multiDeviceClusters: topFp.filter((x) => x.count >= 3).length,
    };
  } catch {
    return { profilesScanned: 0, topFp: [], topIp: [], topCc: [], multiDeviceClusters: 0 };
  }
}

export async function getVerifiedSparklineInternal() {
  try {
    const s = await admin();
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() - i);
      const day = d.toISOString().slice(0, 10);
      const { count } = await s
        .from("submissions")
        .select("id", { count: "exact", head: true })
        .in("status", ["verified", "approved", "auto_approved"])
        .gte("updated_at", day + "T00:00:00.000Z")
        .lte("updated_at", day + "T23:59:59.999Z");
      days.push({ day, count: Number(count ?? 0) });
    }
    return days;
  } catch {
    return [];
  }
}

export async function assertDeviceChangeCooldown(_opts: { userId: string; hours?: number }) {
  /* soft */
}

export async function assertHardInitDataForMoney(opts: { initData?: string | null }) {
  if (!String(opts.initData ?? "").trim()) {
    throw new Error("Open TASKORA from Telegram and try again. Fresh session required for withdrawals.");
  }
  return { ok: true as const };
}

export async function assertRejectSoftBan(_opts: { userId: string }) {
  /* soft */
}
