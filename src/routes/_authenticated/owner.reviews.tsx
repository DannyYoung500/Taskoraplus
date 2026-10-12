import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ChevronLeft,
  ExternalLink,
  Image as ImageIcon,
  ShieldAlert,
  User,
  Zap,
} from "lucide-react";
import { listPendingSubmissions, reviewSubmission } from "@/lib/taskora.functions";
import { AppLink } from "@/components/AppLink";

export const Route = createFileRoute("/_authenticated/owner/reviews")({
  loader: async () => {
    try {
      const rows = await listPendingSubmissions();
      return { rows, error: null as string | null };
    } catch (e) {
      return {
        rows: [] as Awaited<ReturnType<typeof listPendingSubmissions>>,
        error: e instanceof Error ? e.message : "Unable to load reviews",
      };
    }
  },
  component: OwnerReviewsPage,
});

type ProfileJoin = {
  id?: string;
  display_name?: string | null;
  username?: string | null;
  telegram_id?: number | string | null;
  photo_url?: string | null;
} | null;

type TaskJoin = {
  title?: string;
  advertiser?: string;
  reward?: number;
  platform?: string;
  task_type?: string;
  proof?: string;
  link?: string;
} | null;

type RiskSnap = {
  trust: number;
  flags: string[];
  deviceCluster: number;
  pendingSubs: number;
  verified24h: number;
  rejected24h: number;
  accountAgeHours: number;
};

function displayUser(profile: ProfileJoin, userId: string): string {
  if (!profile) return `User ${String(userId).slice(0, 8)}…`;
  const un = profile.username?.trim();
  if (un) return un.startsWith("@") ? un : `@${un}`;
  if (profile.display_name?.trim()) return profile.display_name.trim();
  if (profile.telegram_id) return `TG ${profile.telegram_id}`;
  return `User ${String(userId).slice(0, 8)}…`;
}

function isImageUrl(url: string): boolean {
  const u = url.toLowerCase();
  return (
    /\.(png|jpe?g|gif|webp|bmp)(\?|$)/i.test(u) ||
    u.includes("supabase") ||
    u.includes("/storage/") ||
    u.includes("imgur") ||
    u.includes("cloudinary")
  );
}

function riskTone(flags: string[], trust: number): string {
  if (flags.some((f) => f.startsWith("status:") && f !== "status:active")) {
    return "border-red-400/40 bg-red-500/10 text-red-200";
  }
  if (flags.includes("device_cluster") || flags.includes("recent_rejects")) {
    return "border-amber-400/35 bg-amber-500/10 text-amber-100";
  }
  if (trust >= 75) return "border-emerald-400/30 bg-emerald-500/10 text-emerald-100";
  if (trust < 40) return "border-orange-400/30 bg-orange-500/10 text-orange-100";
  return "border-white/10 bg-white/5 text-white/70";
}

function OwnerReviewsPage() {
  const initial = Route.useLoaderData();
  const [rows, setRows] = useState(initial.rows);
  const [error, setError] = useState(initial.error);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const [expandedProof, setExpandedProof] = useState<string | null>(null);
  const [riskMap, setRiskMap] = useState<Record<string, RiskSnap>>({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMsg, setBulkMsg] = useState("");

  const loadRisks = useCallback(async (list: typeof rows) => {
    const unique = [
      ...new Set(list.map((r) => String(r.user_id)).filter(Boolean)),
    ].slice(0, 40);
    const next: Record<string, RiskSnap> = {};
    await Promise.all(
      unique.map(async (uid) => {
        try {
          const { ownerGetUserRiskSnapshot } = await import("@/lib/strong-p2.functions");
          const snap = await ownerGetUserRiskSnapshot({ data: { userId: uid } });
          next[uid] = {
            trust: Number(snap.trust ?? 50),
            flags: Array.isArray(snap.flags) ? snap.flags.map(String) : [],
            deviceCluster: Number(snap.deviceCluster ?? 1),
            pendingSubs: Number(snap.pendingSubs ?? 0),
            verified24h: Number(snap.verified24h ?? 0),
            rejected24h: Number(snap.rejected24h ?? 0),
            accountAgeHours: Number(snap.accountAgeHours ?? 0),
          };
        } catch {
          /* soft */
        }
      }),
    );
    setRiskMap((prev) => ({ ...prev, ...next }));
  }, []);

  useEffect(() => {
    if (rows.length) void loadRisks(rows);
  }, [rows, loadRisks]);

  async function act(id: string, decision: "verified" | "rejected") {
    setBusyId(id);
    setError(null);
    try {
      await reviewSubmission({
        data: {
          submissionId: id,
          decision,
          ...(decision === "rejected" && rejectNote[id]?.trim()
            ? { reason: rejectNote[id].trim() }
            : {}),
        },
      });
      setRows((prev) => prev.filter((r) => r.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setBusyId(null);
    }
  }

  async function bulkApproveSafe() {
    setBulkBusy(true);
    setBulkMsg("");
    setError(null);
    try {
      const { ownerBulkApproveSubmissions } = await import("@/lib/strong-p4.functions");
      const r = await ownerBulkApproveSubmissions({
        data: {
          minTrust: 60,
          maxReward: 0.5,
          skipDeviceCluster: true,
          submissionIds: rows.map((x) => String(x.id)),
        },
      });
      setBulkMsg(
        `Bulk: ${r.approved} approved · ${r.skipped} skipped` +
          (r.errors?.length ? ` · ${r.errors[0]}` : ""),
      );
      const next = await listPendingSubmissions();
      setRows(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk approve failed");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <div className="mb-4 flex items-center gap-2">
        <AppLink to="/owner" className="rounded-full border border-white/10 p-2 text-white/60">
          <ChevronLeft className="size-4" />
        </AppLink>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold">Task review</h1>
          <p className="text-xs text-white/45">Username · risk · proof · approve or reject</p>
        </div>
      </div>

      {rows.length > 0 ? (
        <div className="mb-3 flex gap-2">
          <button
            type="button"
            disabled={bulkBusy}
            onClick={() => void bulkApproveSafe()}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-2.5 text-xs font-bold text-emerald-100 disabled:opacity-50"
          >
            <Zap className="size-3.5" />
            {bulkBusy ? "Bulk…" : "Bulk safe approve"}
          </button>
        </div>
      ) : null}

      {bulkMsg ? (
        <p className="mb-3 rounded-xl border border-emerald-400/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
          {bulkMsg}
        </p>
      ) : null}

      {error ? (
        <p className="mb-3 rounded-xl border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          {error}
        </p>
      ) : null}

      <div className="space-y-3">
        {rows.length === 0 ? (
          <p className="rounded-2xl border border-white/8 bg-[#12141c] p-4 text-sm text-white/45">
            No pending submissions.
          </p>
        ) : (
          rows.map((row) => {
            const task = (row as { tasks?: TaskJoin }).tasks ?? null;
            const profile =
              ((row as { profiles?: ProfileJoin }).profiles as ProfileJoin) ?? null;
            const proofText = String((row as { proof_text?: string }).proof_text || "").trim();
            const proofUrl = String((row as { proof_url?: string }).proof_url || "").trim();
            const userLabel = displayUser(profile, String(row.user_id));
            const platform = String(task?.platform || "").toLowerCase();
            const proofMode = String(task?.proof || "").toLowerCase();
            const isAuto =
              proofMode === "auto" ||
              proofMode === "automatic" ||
              proofText.startsWith("auto:");
            const risk = riskMap[String(row.user_id)];

            return (
              <div
                key={row.id}
                className="space-y-2.5 rounded-2xl border border-white/8 bg-[#12141c] p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-white/5">
                    {profile?.photo_url ? (
                      <img
                        src={profile.photo_url}
                        alt=""
                        className="size-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User className="size-4 text-white/40" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-cyan-200">{userLabel}</p>
                    <p className="truncate text-[11px] text-white/40">
                      {profile?.display_name && profile.username
                        ? profile.display_name
                        : profile?.telegram_id
                          ? `Telegram ID ${profile.telegram_id}`
                          : `UID ${String(row.user_id).slice(0, 8)}…`}
                    </p>
                    <p className="mt-0.5 text-[10px] text-white/30">
                      {new Date(row.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-emerald-300">
                      ${Number(task?.reward ?? 0).toFixed(2)}
                    </p>
                    <p className="text-[10px] uppercase tracking-wide text-white/35">
                      {platform || "task"}
                    </p>
                  </div>
                </div>

                {risk ? (
                  <div
                    className={`flex flex-wrap items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-[10px] font-semibold ${riskTone(risk.flags, risk.trust)}`}
                  >
                    <ShieldAlert className="size-3 shrink-0 opacity-80" />
                    <span>Trust {risk.trust}</span>
                    {risk.deviceCluster >= 2 ? (
                      <span className="rounded-full bg-black/25 px-1.5 py-0.5">
                        device×{risk.deviceCluster}
                      </span>
                    ) : null}
                    {risk.verified24h > 0 ? (
                      <span className="rounded-full bg-black/25 px-1.5 py-0.5">
                        ✓{risk.verified24h}/24h
                      </span>
                    ) : null}
                    {risk.rejected24h > 0 ? (
                      <span className="rounded-full bg-black/25 px-1.5 py-0.5">
                        ✗{risk.rejected24h}/24h
                      </span>
                    ) : null}
                    {risk.accountAgeHours < 48 ? (
                      <span className="rounded-full bg-black/25 px-1.5 py-0.5">
                        new {Math.round(risk.accountAgeHours)}h
                      </span>
                    ) : null}
                    {risk.flags.slice(0, 3).map((f) => (
                      <span key={f} className="rounded-full bg-black/25 px-1.5 py-0.5">
                        {f}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[10px] text-white/30">Loading risk…</p>
                )}

                <div className="rounded-xl border border-white/6 bg-black/20 px-3 py-2">
                  <p className="text-sm font-semibold">{task?.title ?? "Task"}</p>
                  <p className="text-[11px] text-white/45">
                    {task?.advertiser || "—"}
                    {task?.task_type ? ` · ${task.task_type}` : ""}
                    {isAuto ? " · auto-verify" : " · screenshot/proof"}
                  </p>
                  {task?.link ? (
                    <a
                      href={task.link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-[11px] text-sky-300 underline-offset-2 hover:underline"
                    >
                      Open task link <ExternalLink className="size-3" />
                    </a>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                    Submitted proof
                  </p>
                  {isAuto && !proofUrl ? (
                    <p className="rounded-lg border border-cyan-400/15 bg-cyan-400/5 px-3 py-2 text-xs text-cyan-100/80">
                      Automatic membership check
                      {proofText ? ` · ${proofText}` : ""}
                    </p>
                  ) : null}
                  {proofText && !isAuto ? (
                    <p className="break-all rounded-lg border border-white/8 bg-black/25 px-3 py-2 text-xs text-white/80">
                      {proofText}
                    </p>
                  ) : null}
                  {proofUrl ? (
                    <div className="space-y-1">
                      {isImageUrl(proofUrl) ? (
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedProof((p) => (p === row.id ? null : row.id))
                          }
                          className="block w-full overflow-hidden rounded-xl border border-white/10"
                        >
                          <img
                            src={proofUrl}
                            alt="Proof"
                            className={`w-full object-cover ${expandedProof === row.id ? "max-h-none" : "max-h-40"}`}
                            referrerPolicy="no-referrer"
                          />
                          <span className="flex items-center gap-1 px-2 py-1 text-[10px] text-white/45">
                            <ImageIcon className="size-3" />
                            {expandedProof === row.id ? "Tap to shrink" : "Tap to expand"}
                          </span>
                        </button>
                      ) : (
                        <a
                          href={proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-xs text-sky-300 underline-offset-2 hover:underline"
                        >
                          {proofUrl}
                        </a>
                      )}
                    </div>
                  ) : null}
                  {!proofText && !proofUrl && !isAuto ? (
                    <p className="text-xs text-white/40">No proof attached.</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <input
                    className="w-full rounded-xl border border-white/10 bg-black/25 px-3 py-2 text-xs text-white outline-none placeholder:text-white/30 focus:border-sky-400/40"
                    placeholder="Reject reason (optional)"
                    value={rejectNote[row.id] ?? ""}
                    onChange={(e) =>
                      setRejectNote((m) => ({ ...m, [row.id]: e.target.value }))
                    }
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => void act(row.id, "verified")}
                      className="flex-1 rounded-xl bg-emerald-400 py-2.5 text-xs font-extrabold text-[#05070c] disabled:opacity-50"
                    >
                      {busyId === row.id ? "…" : "Approve"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => void act(row.id, "rejected")}
                      className="flex-1 rounded-xl border border-red-400/40 bg-red-500/15 py-2.5 text-xs font-extrabold text-red-200 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
