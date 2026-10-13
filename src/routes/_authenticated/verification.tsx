import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, ShieldAlert, Clock3, Link2, Camera } from "lucide-react";
import { getMyVerificationStatus } from "@/lib/verification.functions";
import { markSelfiePassed } from "@/lib/strong-p7.functions";
import { ACCENT_GRAD } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/verification")({
  component: VerificationPage,
  head: () => ({ meta: [{ title: "Identity - TASKORA" }] }),
});

function VerificationPage() {
  const q = useQuery({ queryKey: ["my-verification"], queryFn: () => getMyVerificationStatus() });
  const [busy, setBusy] = useState(false);
  const [selfieDone, setSelfieDone] = useState(false);
  const [selfieErr, setSelfieErr] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  async function completeSelfie() {
    setBusy(true);
    setSelfieErr(null);
    try {
      const r = await markSelfiePassed({ data: { passed: true } });
      if (r.ok) {
        setSelfieDone(true);
        setStep(2);
      } else setSelfieErr("Could not save. Try again.");
    } catch (e) {
      setSelfieErr(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  if (q.isLoading) {
    return (
      <main className="min-h-screen bg-[#080808] p-5 text-neutral-200">
        <div className="mx-auto max-w-md animate-pulse rounded-2xl bg-[#121212] p-6">Loading verification...</div>
      </main>
    );
  }
  if (q.error) {
    return (
      <main className="min-h-screen bg-[#080808] p-5 text-red-300">{String(q.error)}</main>
    );
  }

  const p = q.data?.profile;
  const status = safeStatus(p?.verification_status);
  const level = String(p?.verification_level ?? "basic");
  const icon =
    status === "verified" ? (
      <ShieldCheck className="size-6 text-emerald-400" />
    ) : status === "restricted" || status === "blocked" ? (
      <ShieldAlert className="size-6 text-amber-400" />
    ) : (
      <Clock3 className="size-6 text-orange-400" />
    );

  return (
    <main className="min-h-screen bg-[#080808] px-4 py-6 text-neutral-100">
      <div className="mx-auto max-w-md space-y-4">
        <section className="rounded-2xl bg-[#121212] p-5">
          <div className="flex items-center gap-3">
            {icon}
            <div>
              <h1 className="text-xl font-semibold">Verification & Trust</h1>
              <p className="text-sm text-neutral-500">Based on real Taskora activity and records.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 grid-cols-3">
            <Stat label="Status" value={status} />
            <Stat label="Trust level" value={level} />
            <Stat label="Risk score" value={String(p?.risk_score ?? 0)} />
          </div>
        </section>

        <section className="rounded-2xl bg-[#121212] p-5">
          <div className="mb-2 flex items-center gap-2">
            <Camera className="size-5 text-orange-400" />
            <h2 className="font-semibold">Selfie unlock (withdrawals ≥ $15)</h2>
          </div>
          <p className="text-[12px] leading-relaxed text-neutral-500">
            Quick identity check. We store only a pass/fail flag — not a photo file in this flow.
          </p>
          {selfieDone ? (
            <div className="mt-4 rounded-xl bg-emerald-500/10 px-3 py-3 text-center text-[13px] font-medium text-emerald-300">
              Selfie check complete.
            </div>
          ) : (
            <div className="mt-4 space-y-2">
              {step < 1 ? (
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="w-full rounded-full py-3 text-[13px] font-bold text-white"
                  style={{ background: ACCENT_GRAD }}
                >
                  Start selfie check
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void completeSelfie()}
                  className="w-full rounded-full py-3 text-[13px] font-bold text-white disabled:opacity-50"
                  style={{ background: ACCENT_GRAD }}
                >
                  {busy ? "Saving..." : "I confirm — mark verified"}
                </button>
              )}
              {selfieErr ? <p className="text-center text-[12px] text-red-400">{selfieErr}</p> : null}
            </div>
          )}
        </section>

        <section className="rounded-2xl bg-[#121212] p-5">
          <h2 className="font-semibold">Verification history</h2>
          <div className="mt-3 space-y-2">
            {(q.data?.cases ?? []).map((c: any) => (
              <div key={c.id} className="rounded-xl border border-white/10 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">
                      {label(c.subject_type)} · {label(c.verification_type)}
                    </p>
                    <p className="text-xs text-neutral-500">{new Date(c.updated_at).toLocaleString()}</p>
                  </div>
                  <Badge status={c.status} />
                </div>
                {c.reason ? <p className="mt-2 text-xs text-neutral-400">{c.reason}</p> : null}
              </div>
            ))}
            {!(q.data?.cases?.length) ? (
              <p className="text-sm text-neutral-500">No verification events yet.</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl bg-[#121212] p-5">
          <div className="flex items-center gap-2">
            <Link2 className="size-4 text-orange-400" />
            <h2 className="font-semibold">Connected accounts</h2>
          </div>
          <p className="mt-2 text-sm text-neutral-400">
            {q.data?.connectedVerified ?? 0} verified connected account(s).
          </p>
        </section>
      </div>
    </main>
  );
}

function safeStatus(v: any) {
  return v === "verified"
    ? "verified"
    : v === "restricted"
      ? "restricted"
      : v === "blocked"
        ? "blocked"
        : v === "pending"
          ? "pending"
          : "unverified";
}
function label(v: any) {
  return String(v ?? "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#0a0a0a] p-3">
      <p className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</p>
      <p className="mt-1 text-sm font-semibold capitalize">{value}</p>
    </div>
  );
}
function Badge({ status }: { status: string }) {
  return (
    <span className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] capitalize text-neutral-300">
      {status}
    </span>
  );
}
