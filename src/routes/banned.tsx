import { createFileRoute, Link } from "@tanstack/react-router";
import { TASKORA_LOGO, TASKORA_NAME } from "@/lib/brand";

export const Route = createFileRoute("/banned")({
  head: () => ({ meta: [{ title: "Account Banned — TASKORA" }] }),
  component: BannedPage,
});

function BannedPage() {
  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center overflow-hidden bg-[#0a0508] px-5 py-10 text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 20%, rgba(220,38,38,0.35), transparent 55%), radial-gradient(ellipse at 50% 100%, rgba(127,29,29,0.25), transparent 40%)",
        }}
      />
      <div className="relative z-10 flex w-full flex-col items-center">
        <div className="mb-4 flex items-center gap-2">
          <img src={TASKORA_LOGO} alt="" className="size-9 rounded-full object-cover ring-2 ring-red-500/50" />
          <div>
            <p className="text-sm font-extrabold tracking-wide text-white">{TASKORA_NAME}</p>
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-red-300/70">
              Earn · Play · Grow
            </p>
          </div>
        </div>

        <div className="relative mb-5">
          <div className="absolute -inset-6 rounded-full bg-red-600/30 blur-2xl" />
          <img
            src={TASKORA_LOGO}
            alt="TASKORA"
            className="relative size-28 rounded-full object-cover ring-4 ring-red-500/40 shadow-[0_0_40px_rgba(220,38,38,0.5)]"
          />
          <div className="absolute -right-2 -top-2 flex size-12 items-center justify-center rounded-xl border-2 border-red-400 bg-red-600 text-2xl font-black shadow-lg">
            ✕
          </div>
        </div>

        <div className="mb-5 w-full rounded-2xl border border-red-500/40 bg-gradient-to-b from-[#1a080c] to-[#120508] px-4 py-5 text-center shadow-[0_0_30px_rgba(220,38,38,0.2)]">
          <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.25em] text-amber-300/90">⚠ Warning</p>
          <h1 className="text-3xl font-black leading-none tracking-tight">
            <span className="text-white">ACCOUNT</span>
            <br />
            <span className="bg-gradient-to-b from-red-300 to-red-600 bg-clip-text text-transparent">
              BANNED
            </span>
          </h1>
        </div>

        <div className="w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-4 backdrop-blur">
          <p className="text-center text-sm font-bold text-white">Your account has been banned</p>
          <p className="mt-2 text-center text-[12px] leading-relaxed text-white/55">
            Your account has been permanently banned due to a violation of our Terms of Service. This
            action cannot be reversed.
          </p>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] font-semibold text-red-400">
            <span className="text-base">⊘</span> Reason: Violation of Terms of Service
          </p>
          <p className="mt-2 text-center text-[11px] text-white/40">
            If you believe this is a mistake, please contact our support team for further assistance.
          </p>
        </div>

        <Link
          to="/support"
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full border border-red-400/50 bg-gradient-to-r from-red-600 to-red-700 py-3.5 text-sm font-bold text-white shadow-[0_0_24px_rgba(220,38,38,0.35)]"
        >
          🎧 Contact Support →
        </Link>

        <p className="mt-6 text-center text-[10px] uppercase tracking-[0.18em] text-white/30">
          TASKORA · Your earnings. Our priority.
        </p>
      </div>
    </main>
  );
}
