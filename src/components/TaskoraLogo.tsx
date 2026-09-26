/** Official TASKORA brand mark used across Mini App surfaces. */
import { TASKORA_LOGO } from "@/lib/brand";

export const TASKORA_LOGO_SRC = TASKORA_LOGO;

type Props = {
  size?: number;
  className?: string;
  /** Show wordmark next to mark */
  withWordmark?: boolean;
  wordmarkClassName?: string;
};

export function TaskoraLogo({
  size = 40,
  className = "",
  withWordmark = false,
  wordmarkClassName = "",
}: Props) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img
        src={TASKORA_LOGO_SRC}
        alt="TASKORA"
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover ring-1 ring-sky-400/30"
        style={{ width: size, height: size }}
      />
      {withWordmark ? (
        <span
          className={`font-extrabold tracking-wide ${wordmarkClassName || "text-base"}`}
          style={{
            background: "linear-gradient(90deg,#7dd3fc,#38bdf8,#0ea5e9)",
            WebkitBackgroundClip: "text",
            color: "transparent",
          }}
        >
          TASKORA
        </span>
      ) : null}
    </span>
  );
}
