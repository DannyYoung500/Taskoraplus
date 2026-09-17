import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TASKORA_LOGO, TASKORA_NAME } from "@/lib/brand";
import { getMaintenanceMode } from "@/lib/account-access.functions";

export const Route = createFileRoute("/maintenance")({
  head: () => ({ meta: [{ title: "Maintenance — TASKORA" }] }),
  component: MaintenancePage,
});

function MaintenancePage() {
  const [message, setMessage] = useState(
    "We are currently performing scheduled maintenance to improve your experience.",
  );

  useEffect(() => {
    void getMaintenanceMode()
      .then((m) => {
        if (m.message) setMessage(m.message);
      })
      .catch(() => undefined);
  }, []);

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center overflow-hidden bg-[#050b18] px-5 py-10 text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 22%, rgba(37,99,235,0.4), transparent 55%), radial-gradient(ellipse at 50% 95%, rgba(14,165,233,0.12), transparent 40%)",
        }}
      />
      <div className="relative z-10 flex w-full flex-col items-center">
        <div className="mb-5 flex items-center gap-2">
          <img src={TASKORA_LOGO} alt="" className="size-10 rounded-full object-cover ring-2 ring-sky-400/50" />
          <div>
            <p className="text-base font-extrabold tracking-wide">{TASKORA_NAME}</p>
            <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-sky-300/70">
              Earn · Play · Grow
            </p>
          </div>
        </div>

        <div className="relative mb-4">
          <div className="absolute -inset-8 rounded-full bg-sky-500/30 blur-2xl" />
          <img
            src={TASKORA_LOGO}
            alt="TASKORA"
            className="relative size-36 rounded-full object-cover ring-4 ring-sky-400/40 shadow-[0_0_50px_rgba(56,189,248,0.45)]"
          />
        </div>

        <div className="mb-2 inline-flex items-center gap-2 rounded-xl border border-sky-400/40 bg-sky-500/15 px-4 py-2">
          <span className="text-lg">🔧</span>
          <span className="text-xs font-bold uppercase tracking-wide text-sky-200">Maintenance</span>
        </div>

        <h1 className="mt-2 text-center text-3xl font-black tracking-tight">
          <span className="text-white">MAINTENANCE</span>{" "}
          <span className="bg-gradient-to-r from-sky-300 to-blue-500 bg-clip-text text-transparent">
            MODE
          </span>
        </h1>
        <p className="mt-2 text-center text-[12px] font-semibold uppercase tracking-[0.16em] text-sky-300/70">
          We're working on something great
        </p>

        <div className="mt-6 w-full space-y-3 rounded-2xl border border-sky-400/25 bg-[#0a1528]/90 p-4">
          <div className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-sky-300">
              ⚙️
            </span>
            <div>
              <p className="text-sm font-bold text-sky-100">System Maintenance</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-white/55">{message}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-sky-300">
              ⏱
            </span>
            <div>
              <p className="text-sm font-bold text-sky-100">Will Be Back Soon</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-white/55">
                We expect to be back online shortly. Thanks for your patience!
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-sky-300">
              🛡
            </span>
            <div>
              <p className="text-sm font-bold text-sky-100">Better & Stronger</p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-white/55">
                This helps us deliver a faster, safer and more rewarding platform for you.
              </p>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-[11px] text-white/40">Thank you for your support 💙</p>
      </div>
    </main>
  );
}
