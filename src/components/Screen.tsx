import type { ReactNode } from "react";
import { TASKORA_LOGO } from "@/lib/brand";

export function Screen({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <main
      className={`mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white ${className}`}
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
          className="size-9 rounded-full object-cover ring-2 ring-amber-400/35"
        />
        <span
          className="text-[11px] font-extrabold uppercase tracking-[0.28em]"
          style={{
            background: "linear-gradient(90deg,#FFE08A,#F5C542)",
            WebkitBackgroundClip: "text",
            color: "transparent",
          }}
        >
          TASKORA
        </span>
      </div>
      <h1 className="text-xl font-bold tracking-tight text-white">{title}</h1>
      {subtitle ? <p className="mt-1 text-xs text-white/45">{subtitle}</p> : null}
    </header>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/8 bg-[#12141c] ${className}`}>{children}</div>
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
      className={`w-full rounded-2xl px-4 py-3.5 text-sm font-extrabold text-[#05070c] disabled:opacity-50 ${className}`}
      style={{ background: "linear-gradient(135deg, #FFE08A, #F5C542, #C9961A)" }}
    >
      {children}
    </button>
  );
}
