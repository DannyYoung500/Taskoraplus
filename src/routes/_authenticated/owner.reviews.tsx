import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronLeft, ExternalLink, Image as ImageIcon, User } from "lucide-react";
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

function OwnerReviewsPage() {
  const initial = Route.useLoaderData();
  const [rows, setRows] = useState(initial.rows);
  const [error, setError] = useState(initial.error);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const [expandedProof, setExpandedProof] = useState<string | null>(null);

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

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <div className="mb-4 flex items-center gap-2">
        <AppLink to="/owner" className="rounded-full border border-white/10 p-2 text-white/60">
          <ChevronLeft className="size-4" />
        </AppLink>
        <div>
          <h1 className="text-xl font-bold">Task review</h1>
          <p className="text-xs text-white/45">
            Username · proof image/URL · approve or reject
          </p>
        </div>
      </div>

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
                    <div className="space-y-1.5">
                      {isImageUrl(proofUrl) ? (
                        <button
                          type="button"
                          className="block w-full overflow-hidden rounded-xl border border-white/10"
                          onClick={() =>
                            setExpandedProof(expandedProof === row.id ? null : row.id)
                          }
                        >
                          <img
                            src={proofUrl}
                            alt="Proof"
                            className={
                              expandedProof === row.id
                                ? "max-h-[480px] w-full object-contain bg-black"
                                : "max-h-40 w-full object-cover"
                            }
                            referrerPolicy="no-referrer"
                          />
                          <span className="flex items-center justify-center gap-1 bg-black/40 py-1 text-[10px] text-white/50">
                            <ImageIcon className="size-3" />
                            {expandedProof === row.id ? "Tap to shrink" : "Tap to enlarge"}
                          </span>
                        </button>
                      ) : (
                        <a
                          href={proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-2 break-all rounded-lg border border-sky-400/20 bg-sky-400/5 px-3 py-2 text-xs text-sky-200"
                        >
                          <ExternalLink className="size-3.5 shrink-0" />
                          {proofUrl}
                        </a>
                      )}
                    </div>
                  ) : null}
                  {!proofText && !proofUrl && !isAuto ? (
                    <p className="text-xs text-amber-300/80">No proof text or URL attached.</p>
                  ) : null}
                </div>

                <input
                  type="text"
                  placeholder="Reject reason (optional)"
                  value={rejectNote[row.id] || ""}
                  onChange={(e) =>
                    setRejectNote((prev) => ({ ...prev, [row.id]: e.target.value }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-xs text-white placeholder:text-white/30 outline-none focus:border-cyan-400/40"
                />

                <div className="flex gap-2 pt-0.5">
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void act(row.id, "verified")}
                    className="flex-1 rounded-xl bg-emerald-500/90 py-2.5 text-xs font-bold text-[#05070c] disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busyId === row.id}
                    onClick={() => void act(row.id, "rejected")}
                    className="flex-1 rounded-xl border border-red-400/40 bg-red-500/15 py-2.5 text-xs font-bold text-red-300 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
