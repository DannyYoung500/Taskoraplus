import type { ReactNode } from "react";
import { TASKORA_LOGO, ACCENT_GRAD } from "@/lib/brand";

/** Soft NEWTUBE-inspired shell — warm orange on near-black, no heavy borders */
export function Screen({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <main
      className={`mx-auto min-h-screen w-full max-w-md bg-[#080808] px-4 pb-28 pt-5 text-neutral-100 ${className}`}
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
          className="tk-logo size-9 rounded-full object-cover"
          draggable={false}
          data-no-preview
          onContextMenu={(e) => e.preventDefault()}
          style={{ pointerEvents: "none" }}
        />
        <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-orange-400/90">
          TASKORA
        </span>
      </div>
      <h1 className="text-xl font-medium tracking-tight text-neutral-50">{title}</h1>
      {subtitle ? <p className="mt-1 text-xs font-normal text-neutral-500">{subtitle}</p> : null}
    </header>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-[#121212] ${className}`}>{children}</div>;
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
      className={`w-full rounded-2xl px-4 py-3.5 text-sm font-semibold text-white disabled:opacity-50 ${className}`}
      style={{ background: ACCENT_GRAD }}
    >
      {children}
    </button>
  );
}
