import { createFileRoute, notFound } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  ListChecks,
  AlertTriangle,
} from "lucide-react";
import { PlatformLogo, platformLabel, type Platform } from "@/components/PlatformIcon";
import { getTask } from "@/lib/taskora.functions";
import { submitTaskGuarded } from "@/lib/taskora-mutations.functions";
import { AppLink } from "@/components/AppLink";
import { formatUsd } from "@/lib/taskora-display";

export const Route = createFileRoute("/_authenticated/tasks/$taskId")({
  head: () => ({ meta: [{ title: "Task — TASKORA" }] }),
  loader: async ({ params }) => {
    const task = await getTask({ data: { taskId: params.taskId } }).catch(() => null);
    if (!task) throw notFound();
    return { task };
  },
  component: TaskDetail,
});

function difficultyLabel(d?: string | null) {
  const v = String(d || "easy").toLowerCase();
  if (v === "hard") return "HARD";
  if (v === "medium") return "MEDIUM";
  return "EASY";
}

function estimateMins(seconds?: number | null) {
  const s = Math.max(0, Number(seconds || 0));
  if (s <= 0) return "2 mins";
  if (s < 60) return `${s}s`;
  return `${Math.max(1, Math.round(s / 60))} mins`;
}

function TaskDetail() {
  const { task } = Route.useLoaderData();
  const [submitted, setSubmitted] = useState(false);
  const [proofUsername, setProofUsername] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [shots, setShots] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [autoStatus, setAutoStatus] = useState<string | null>(null);
  const fileRefs = useRef<(HTMLInputElement | null)[]>([]);

  const platform = String(task.platform || "other").toLowerCase() as Platform;
  const proofMode = String((task as { proof?: string }).proof ?? "screenshot").toLowerCase();
  const isAuto =
    proofMode === "auto" ||
    (platform === "telegram" &&
      ["join", "subscribe"].includes(String((task as { task_type?: string }).task_type || "")));
  const steps: string[] = Array.isArray((task as { steps?: string[] }).steps)
    ? (task as { steps: string[] }).steps
    : String((task as { instructions?: string }).instructions || "")
        .split(/\n/)
        .map((s) => s.trim())
        .filter(Boolean);
  const warning =
    String((task as { warning_text?: string }).warning_text || "").trim() ||
    "Do not unfollow or leave after submission. Your account must be real and active. Fake or bot accounts will be rejected.";
  const slotsLeft = Number((task as { slots_left?: number }).slots_left ?? 0);
  const slotsTotal = Number((task as { slots_total?: number }).slots_total ?? 0);
  const reward = Number(task.reward ?? 0);
  const link = String(task.link ?? "").trim();
  const featured = Boolean((task as { featured?: boolean }).featured);
  const difficulty = difficultyLabel((task as { difficulty?: string }).difficulty);
  const screenshotsRequired = Math.max(
    1,
    Math.min(3, Number((task as { screenshots_required?: number }).screenshots_required ?? 1)),
  );
  const needsUsername = ["x", "instagram", "tiktok", "youtube", "facebook", "threads"].includes(
    platform,
  );

  const defaultSteps = useMemo(() => {
    if (steps.length) return steps;
    return [
      "Open the link provided below",
      "Follow / Subscribe / Join as required",
      "Take a clear screenshot showing you completed the action",
      "Submit your screenshot as proof",
    ];
  }, [steps]);

  async function copyText(text: string, kind: "id" | "link") {
    try {
      await navigator.clipboard.writeText(text);
      if (kind === "id") {
        setCopiedId(true);
        setTimeout(() => setCopiedId(false), 1500);
      } else {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 1500);
      }
    } catch {
      /* soft */
    }
  }

  function openLink() {
    if (!link) return;
    window.open(link, "_blank", "noopener,noreferrer");
  }

  function onPickShot(index: number, file: File | null) {
    if (!file) return;
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) {
      setError("Use JPEG, PNG, or WebP only.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("Image max 15 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setShots((prev) => {
        const next = [...prev];
        next[index] = dataUrl;
        return next;
      });
      setError(null);
    };
    reader.readAsDataURL(file);
  }

  async function onAutoVerify() {
    setBusy(true);
    setError(null);
    setAutoStatus("Checking membership…");
    try {
      await submitTaskGuarded({
        data: { taskId: task.id, proofText: "auto:telegram_membership" },
      });
      setSubmitted(true);
      setAutoStatus("Verified · membership confirmed");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Auto-verify failed");
      setAutoStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function onSubmitProof() {
    setBusy(true);
    setError(null);
    try {
      if (needsUsername && !proofUsername.trim()) {
        throw new Error(`Enter your ${platformLabel(platform)} username.`);
      }
      const filled = shots.filter(Boolean);
      if (!isAuto && filled.length < screenshotsRequired) {
        throw new Error(
          `Add ${screenshotsRequired} screenshot${screenshotsRequired > 1 ? "s" : ""} to submit.`,
        );
      }
      const textParts = [
        proofUsername.trim() ? `@${proofUsername.trim().replace(/^@/, "")}` : "",
        proofNote.trim(),
      ].filter(Boolean);
      const proofText = textParts.join(" · ") || "screenshot_proof";
      const proofUrl = filled[0] || undefined;
      await submitTaskGuarded({
        data: {
          taskId: task.id,
          proofText,
          proofUrl,
        },
      });
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit proof");
    } finally {
      setBusy(false);
    }
  }

  if (submitted) {
    return (
      <main className="mx-auto min-h-screen w-full max-w-md bg-[#080808] px-4 pb-28 pt-6 text-neutral-100">
        <div className="rounded-2xl bg-[#121212] p-6 text-center">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-500/15">
            <CheckCircle2 className="size-7 text-emerald-400" strokeWidth={1.75} />
          </div>
          <p className="text-[17px] font-medium text-neutral-50">Proof submitted</p>
          <p className="mt-2 text-[13px] leading-relaxed text-neutral-500">
            {isAuto
              ? "Membership verified. Reward will credit shortly."
              : "Your proof is in the review queue. Reward credits after verification."}
          </p>
          {autoStatus ? <p className="mt-3 text-[12px] text-emerald-400">{autoStatus}</p> : null}
        </div>
        <AppLink
          to="/tasks"
          className="mt-4 flex w-full items-center justify-center rounded-2xl bg-orange-500 py-3.5 text-[14px] font-medium text-[#0a0a0a]"
        >
          Back to tasks
        </AppLink>
      </main>
    );
  }

  const shotsFilled = shots.filter(Boolean).length;

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#080808] px-4 pb-28 pt-3 text-neutral-100">
      <AppLink
        to="/tasks"
        className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-neutral-500"
      >
        <ArrowLeft className="size-4" strokeWidth={1.75} />
        Back to Tasks
      </AppLink>

      <section className="rounded-2xl bg-[#121212] p-4">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#1a1a1a]">
            <PlatformLogo platform={platform} size={28} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[16px] font-medium leading-snug text-neutral-50">{task.title}</p>
              <span className="shrink-0 text-[16px] font-semibold text-emerald-400">
                {formatUsd(reward)}
              </span>
            </div>
            <p className="mt-0.5 text-[12px] text-neutral-500">{platformLabel(platform)}</p>
            {slotsLeft > 0 || slotsTotal > 0 ? (
              <p className="mt-1 text-[11px] text-neutral-600">
                {slotsLeft}
                {slotsTotal ? ` / ${slotsTotal}` : ""} spots available
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-neutral-800 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-300">
            {difficulty}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-neutral-800 px-2.5 py-1 text-[10px] font-medium text-neutral-400">
            <Clock3 className="size-3" strokeWidth={1.75} />
            {estimateMins((task as { seconds?: number }).seconds)}
          </span>
          {featured ? (
            <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-400">
              Featured
            </span>
          ) : null}
        </div>

        <p className="mt-3 text-[13px] leading-relaxed text-neutral-400">
          {String((task as { description?: string }).description || "").trim() ||
            `Complete this ${platformLabel(platform)} task to earn ${formatUsd(reward)}. Follow the instructions carefully and submit clear proof.`}
        </p>

        <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-600">
              Task ID
            </p>
            <p className="mt-0.5 truncate font-mono text-[11px] text-neutral-500">{task.id}</p>
          </div>
          <button
            type="button"
            onClick={() => void copyText(String(task.id), "id")}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#1a1a1a] text-neutral-400"
            aria-label="Copy task ID"
          >
            <Copy className="size-3.5" strokeWidth={1.75} />
          </button>
        </div>
        {copiedId ? <p className="mt-1 text-[11px] text-emerald-400">Task ID copied</p> : null}
      </section>

      <section className="mt-3 rounded-2xl bg-[#121212] p-4">
        <div className="mb-3 flex items-center gap-2">
          <ListChecks className="size-4 text-orange-400" strokeWidth={1.75} />
          <p className="text-[14px] font-medium text-neutral-100">Instructions</p>
        </div>
        <ol className="space-y-2.5">
          {defaultSteps.map((step, i) => (
            <li key={i} className="flex gap-2.5 text-[13px] leading-relaxed text-neutral-400">
              <span className="shrink-0 font-medium text-neutral-500">{i + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </section>

      <div className="mt-3 space-y-2">
        <button
          type="button"
          onClick={openLink}
          disabled={!link}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3.5 text-[14px] font-medium text-[#0a0a0a] disabled:opacity-40"
        >
          <ExternalLink className="size-4" strokeWidth={1.75} />
          Open Task Link
        </button>
        <button
          type="button"
          onClick={() => void copyText(link, "link")}
          disabled={!link}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#1a1a1a] py-3.5 text-[14px] font-medium text-neutral-200 disabled:opacity-40"
        >
          <Copy className="size-4" strokeWidth={1.75} />
          {copiedLink ? "Link copied" : "Copy Link"}
        </button>
        <p className="px-1 text-center text-[11px] text-neutral-600">
          If the link does not open, tap Copy Link and paste it into your browser.
        </p>
      </div>

      <div className="mt-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 px-3.5 py-3">
        <div className="flex gap-2">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" strokeWidth={1.75} />
          <div>
            <p className="text-[12px] font-semibold text-amber-300">Important</p>
            <p className="mt-1 text-[12px] leading-relaxed text-amber-200/80">{warning}</p>
          </div>
        </div>
      </div>

      <section className="mt-3 rounded-2xl bg-[#121212] p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="size-4 text-orange-400" strokeWidth={1.75} />
            <p className="text-[14px] font-medium text-neutral-100">Submit Proof</p>
          </div>
          {!isAuto ? (
            <span className="text-[11px] text-neutral-500">
              {shotsFilled} of {screenshotsRequired} added
            </span>
          ) : null}
        </div>

        {needsUsername ? (
          <div className="mb-3">
            <label className="mb-1.5 block text-[12px] font-medium text-neutral-400">
              Your {platformLabel(platform)} username <span className="text-orange-400">*</span>
            </label>
            <input
              value={proofUsername}
              onChange={(e) => setProofUsername(e.target.value)}
              placeholder={`@ Your ${platformLabel(platform)} username`}
              className="w-full rounded-xl bg-[#1a1a1a] px-3.5 py-3 text-[13px] text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-orange-500/40"
            />
            <p className="mt-1.5 text-[11px] text-neutral-600">
              This must match the handle you used to perform the task.
            </p>
          </div>
        ) : null}

        {isAuto ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void onAutoVerify()}
            className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 text-[14px] font-medium text-[#0a0a0a] disabled:opacity-50"
          >
            {busy ? "Verifying…" : "Auto-verify membership"}
          </button>
        ) : null}

        {!isAuto || shotsFilled > 0 ? (
          <div className="space-y-2.5">
            {Array.from({ length: screenshotsRequired }).map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => fileRefs.current[i]?.click()}
                className="relative flex w-full flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[#0c0c0c] px-4 py-8 text-center"
              >
                {shots[i] ? (
                  <img src={shots[i]} alt="" className="max-h-40 w-full rounded-xl object-contain" />
                ) : (
                  <>
                    <span className="mb-2 flex size-10 items-center justify-center rounded-full bg-orange-500/15">
                      <Camera className="size-5 text-orange-400" strokeWidth={1.75} />
                    </span>
                    <p className="text-[13px] font-medium text-neutral-300">
                      Screenshot {i + 1} of {screenshotsRequired}
                    </p>
                    <p className="mt-1 text-[11px] text-neutral-600">PNG · JPG · WebP up to 15MB</p>
                  </>
                )}
                <input
                  ref={(el) => {
                    fileRefs.current[i] = el;
                  }}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => onPickShot(i, e.target.files?.[0] ?? null)}
                />
              </button>
            ))}
          </div>
        ) : null}

        <div className="mt-3">
          <label className="mb-1.5 block text-[12px] font-medium text-neutral-500">
            Note (optional)
          </label>
          <textarea
            value={proofNote}
            onChange={(e) => setProofNote(e.target.value)}
            rows={2}
            placeholder="Anything the reviewer should know…"
            className="w-full resize-none rounded-xl bg-[#1a1a1a] px-3.5 py-2.5 text-[13px] text-neutral-100 outline-none placeholder:text-neutral-600 focus:ring-1 focus:ring-orange-500/40"
          />
        </div>

        <button
          type="button"
          disabled={busy || (!isAuto && shotsFilled < screenshotsRequired)}
          onClick={() => void onSubmitProof()}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 py-3.5 text-[14px] font-medium text-[#0a0a0a] disabled:opacity-40"
        >
          {busy ? "Submitting…" : "Submit Proof"}
        </button>
        {!isAuto && shotsFilled < screenshotsRequired ? (
          <p className="mt-2 text-center text-[11px] text-neutral-600">
            Add {screenshotsRequired - shotsFilled} more screenshot
            {screenshotsRequired - shotsFilled > 1 ? "s" : ""} to submit.
          </p>
        ) : null}
        {error ? <p className="mt-2 text-center text-[12px] text-amber-300">{error}</p> : null}
        {autoStatus ? <p className="mt-2 text-center text-[12px] text-emerald-400">{autoStatus}</p> : null}
      </section>
    </main>
  );
}
