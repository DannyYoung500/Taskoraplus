import { createFileRoute, Link } from "@tanstack/react-router";
import { TASKORA_LOGO, TASKORA_NAME } from "@/lib/brand";

export const Route = createFileRoute("/suspended")({
  head: () => ({ meta: [{ title: "Account Suspended — TASKORA" }] }),
  component: SuspendedPage,
});

function SuspendedPage() {
  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center overflow-hidden bg-[#060b18] px-5 py-10 text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 25%, rgba(37,99,235,0.35), transparent 55%), radial-gradient(ellipse at 50% 100%, rgba(30,58,138,0.2), transparent 40%)",
        }}
      />
      <div className="relative z-10 flex w-full flex-col items-center">
        <div className="mb-4 flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={TASKORA_LOGO} alt="" className="size-9 rounded-full object-cover ring-2 ring-sky-400/50" />
            <div>
              <p className="text-sm font-extrabold tracking-wide">{TASKORA_NAME}</p>
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-sky-300/70">
                Earn · Play · Grow
              </p>
            </div>
          </div>
          <p className="max-w-[100px] text-right text-[9px] font-semibold leading-tight text-sky-300/80">
            Fair Play Builds a Better Community
          </p>
        </div>

        <div className="relative mb-5">
          <div className="absolute -inset-8 rounded-full bg-sky-500/25 blur-2xl" />
          <img
            src={TASKORA_LOGO}
            alt="TASKORA"
            className="relative size-32 rounded-full object-cover ring-4 ring-sky-400/40 shadow-[0_0_48px_rgba(56,189,248,0.4)]"
          />
          <div className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center justify-center rounded-xl border border-sky-400/50 bg-sky-600 px-3 py-1.5 shadow-lg">
            <span className="text-lg">🔒</span>
          </div>
        </div>

        <div className="mb-4 w-full rounded-2xl border border-sky-400/30 bg-gradient-to-b from-[#0c1a33] to-[#081224] px-4 py-5 text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-sky-300/80">Account</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-sky-100">SUSPENDED</h1>
          <p className="mt-2 text-[13px] text-sky-100/80">Your account has been temporarily suspended.</p>
          <p className="mt-1 text-[12px] text-sky-200/50">You cannot access the app at the moment.</p>
        </div>

        <div className="grid w-full gap-2 rounded-2xl border border-white/10 bg-black/30 p-3 sm:grid-cols-2">
          <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-sky-300">Reason</p>
            <p className="mt-1 text-[11px] leading-relaxed text-white/70">
              Suspended due to a violation of our Terms of Service. This action is temporary and may be
              reviewed.
            </p>
          </div>
          <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-sky-300">Suspension period</p>
            <p className="mt-1 text-[11px] text-white/70">Until further review</p>
          </div>
        </div>

        <Link
          to="/support"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-sky-400 to-blue-600 py-3.5 text-sm font-bold text-white shadow-[0_0_24px_rgba(56,189,248,0.35)]"
        >
          🎧 Contact Support →
        </Link>

        <p className="mt-6 text-center text-[10px] text-white/35">
          Thank you for your understanding — Team TASKORA
        </p>
      </div>
    </main>
  );
}
