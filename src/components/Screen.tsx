import type { ReactNode } from "react";
import { TASKORA_LOGO, BLUE_GRAD } from "@/lib/brand";

export function Screen({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <main
      className={`mx-auto min-h-screen w-full max-w-md bg-[#0b1424] px-4 pb-28 pt-5 text-slate-100 ${className}`}
    >
      {children}
    </main>
  );
}

export function ScreenTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-5">
      <div className="mb-3 flex items-center gap-2.5">
        <img
          src={TASKORA_LOGO}
          alt=""
          className="size-9 rounded-full object-cover ring-2 ring-blue-400/40"
        />
        <span
          className="text-[11px] font-extrabold uppercase tracking-[0.28em]"
          style={{
            background: "linear-gradient(90deg,#93c5fd,#3b82f6)",
            WebkitBackgroundClip: "text",
            color: "transparent",
          }}
        >
          TASKORA
        </span>
      </div>
      <h1 className="text-xl font-bold tracking-tight text-white">{title}</h1>
      {subtitle ? <p className="mt-1 text-xs text-slate-400">{subtitle}</p> : null}
    </header>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-500/15 bg-[#121f33] ${className}`}>{children}</div>
  );
}

export function GoldButton({
  children,
  disabled,
  onClick,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick?: () => void;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`w-full rounded-2xl px-4 py-3.5 text-sm font-extrabold text-white disabled:opacity-50 ${className}`}
      style={{ background: BLUE_GRAD }}
    >
      {children}
    </button>
  );
}
