import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Eye, RefreshCw, Users, WalletCards, Clock3, CheckCircle2, PlayCircle, ExternalLink } from "lucide-react";
import { useState } from "react";
import { listMyPostedTasks } from "@/lib/taskora.functions";
import { formatUsd } from "@/lib/taskora-display";
import { TASKORA_LOGO } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/my-tasks")({
  loader: async () => ({ posted: await listMyPostedTasks().catch(() => []) }),
  head: () => ({ meta: [{ title: "My Posted Tasks — TASKORA" }] }),
  component: MyPostedTasks,
});

function compact(n: number) {
  const v = Math.max(0, Number(n) || 0);
  if (v >= 1_000_000) return (v / 1_000_000).toFixed(v >= 10_000_000 ? 0 : 1) + "M";
  if (v >= 1_000) return (v / 1_000).toFixed(v >= 10_000 ? 0 : 1) + "K";
  return String(Math.floor(v));
}

function duration(seconds: number) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m ? `${m}m ${r}s` : `${r}s`;
}

function youtubeThumb(id: string | null) {
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

function MyPostedTasks() {
  const { posted } = Route.useLoaderData();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      const fresh = await listMyPostedTasks();
      // TanStack loader data is intentionally left stable; a navigation refresh is safer than
      // mutating loader internals. This button simply requests a route reload.
      window.location.reload();
      void fresh;
    } finally {
      setRefreshing(false);
    }
  }

  const videos = (posted as any[]).filter((task) => Boolean(task.postedVideo));
  const totalCompletions = (posted as any[]).reduce((n, task) => n + Number(task.submissions?.verified ?? 0), 0);
  const totalSpent = (posted as any[]).reduce((n, task) => n + Number(task.watchRewardPaid ?? 0), 0);

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl bg-[#030814] px-4 pb-28 pt-4 text-white sm:px-6">
      <header className="mb-5 flex items-center gap-3">
        <Link to="/profile" aria-label="Back to profile" className="rounded-xl border border-white/8 bg-white/[.03] p-2.5">
          <ArrowLeft className="size-4 text-slate-300" />
        </Link>
        <img src={TASKORA_LOGO} alt="" className="size-9 rounded-full ring-1 ring-cyan-400/40" />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-black">My Posted Tasks</p>
          <p className="text-[10px] text-slate-500">Track delivery, completions, views and campaign usage.</p>
        </div>
        <button type="button" onClick={() => void refresh()} disabled={refreshing} className="rounded-xl border border-white/8 bg-white/[.03] p-2.5 text-slate-300">
          <RefreshCw className={refreshing ? "size-4 animate-spin" : "size-4"} />
        </button>
      </header>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Metric label="Posted" value={String((posted as any[]).length)} />
        <Metric label="Verified completions" value={String(totalCompletions)} />
        <Metric label="Posted videos" value={String(videos.length)} />
        <Metric label="Rewards paid" value={formatUsd(totalSpent)} />
      </section>

      <section className="mt-5">
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-sm font-black">Posted Video</p>
            <p className="mt-0.5 text-[10px] text-slate-500">Live YouTube views and TASKORA completion activity.</p>
          </div>
          <span className="text-[10px] font-bold text-cyan-300">{videos.length} video{videos.length === 1 ? "" : "s"}</span>
        </div>

        {videos.length === 0 ? (
          <div className="rounded-3xl border border-white/8 bg-[#0b1628] p-8 text-center">
            <PlayCircle className="mx-auto size-8 text-slate-600" />
            <p className="mt-2 text-sm font-bold text-slate-300">No posted videos yet</p>
            <p className="mt-1 text-[10px] text-slate-500">YouTube Watch campaigns you post will appear here with live delivery statistics.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {videos.map((task: any) => {
              const thumb = youtubeThumb(task.youtubeVideoId);
              const stats = task.submissions ?? {};
              const completion = Number(task.watchCompletionCount ?? stats.verified ?? 0);
              const total = Math.max(1, Number(task.slots_total ?? 0));
              const progress = Math.min(100, Math.round((completion / total) * 100));
              return (
                <article key={String(task.id)} className="overflow-hidden rounded-3xl border border-cyan-400/15 bg-[#0b1628]">
                  <div className="relative aspect-video bg-black">
                    {thumb ? <img src={thumb} alt="" className="size-full object-cover" /> : <div className="flex size-full items-center justify-center"><PlayCircle className="size-12 text-slate-600" /></div>}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent px-4 pb-3 pt-10">
                      <p className="truncate text-sm font-black">{String(task.title ?? "Posted video")}</p>
                      <p className="mt-0.5 text-[9px] text-white/60">{String(task.status ?? "draft")} · {String(task.platform ?? "youtube")}</p>
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Stat icon={Eye} label="YouTube views" value={compact(task.youtubeViewsCount)} />
                      <Stat icon={Users} label="Users completed" value={String(completion)} />
                      <Stat icon={CheckCircle2} label="Verified" value={String(stats.verified ?? completion)} />
                      <Stat icon={Clock3} label="Watch time" value={duration(Number(task.seconds ?? 0))} />
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      <Stat icon={WalletCards} label="Reward / user" value={formatUsd(Number(task.reward ?? 0))} />
                      <Stat icon={WalletCards} label="Rewards paid" value={formatUsd(Number(task.watchRewardPaid ?? 0))} />
                      <Stat icon={Users} label="Remaining" value={String(task.remainingSlots ?? task.slots_left ?? 0)} />
                      <Stat icon={PlayCircle} label="Campaign slots" value={String(task.slots_total ?? 0)} />
                    </div>

                    <div className="mt-4">
                      <div className="mb-1.5 flex items-center justify-between text-[9px] font-bold text-slate-500">
                        <span>Completion</span>
                        <span>{progress}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                        <div className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500" style={{ width: progress + "%" }} />
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between border-t border-white/6 pt-3">
                      <div className="text-[9px] text-slate-500">
                        {stats.pending ?? 0} pending · {stats.rejected ?? 0} rejected
                      </div>
                      {task.targetUrl ? (
                        <a href={String(task.targetUrl)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[10px] font-bold text-cyan-300">
                          Open video <ExternalLink className="size-3" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-6">
        <div className="mb-3">
          <p className="text-sm font-black">All posted tasks</p>
          <p className="mt-0.5 text-[10px] text-slate-500">The same delivery stats are available for every campaign type.</p>
        </div>
        <div className="space-y-2">
          {(posted as any[]).map((task) => {
            const stats = task.submissions ?? {};
            return (
              <article key={String(task.id)} className="rounded-2xl border border-white/8 bg-[#0b1628] p-3.5">
                <div className="flex items-start gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-cyan-300">
                    {task.postedVideo ? <PlayCircle className="size-4" /> : <CheckCircle2 className="size-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">{String(task.title ?? "Untitled task")}</p>
                    <p className="mt-0.5 text-[9px] text-slate-500">{String(task.platform ?? "")} · {String(task.status ?? "")}</p>
                  </div>
                  <p className="text-xs font-black text-cyan-300">{String(stats.verified ?? 0)} verified</p>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-white/8 bg-[#0b1628] p-3"><p className="text-[9px] text-slate-500">{label}</p><p className="mt-1 text-base font-black">{value}</p></div>;
}

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return <div className="rounded-xl border border-white/6 bg-black/15 p-2.5"><div className="flex items-center gap-1.5 text-cyan-300"><Icon className="size-3.5" /><span className="text-[8px] text-slate-500">{label}</span></div><p className="mt-1 text-sm font-black tabular-nums">{value}</p></div>;
}
