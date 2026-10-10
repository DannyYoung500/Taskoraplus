/**
 * Internal navigation without <a href>.
 * Speed: haptic + immediate navigate + touchstart preload + no double-fire.
 */
import { useRouter } from "@tanstack/react-router";
import { useRef, type CSSProperties, type MouseEvent, type ReactNode, type TouchEvent } from "react";

type AppLinkProps = {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
  replace?: boolean;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void;
  "aria-label"?: string;
  "aria-current"?: "page" | boolean | undefined;
  disabled?: boolean;
};

function hapticLight() {
  try {
    const tg = (window as unknown as {
      Telegram?: { WebApp?: { HapticFeedback?: { impactOccurred?: (s: string) => void } } };
    }).Telegram?.WebApp;
    tg?.HapticFeedback?.impactOccurred?.("light");
  } catch {
    /* soft */
  }
}

export function AppLink({
  to,
  params,
  search,
  replace,
  children,
  className,
  style,
  onClick,
  disabled,
  ...rest
}: AppLinkProps) {
  const router = useRouter();
  const navigating = useRef(false);

  function go() {
    if (disabled || navigating.current) return;
    navigating.current = true;
    hapticLight();
    void router
      .navigate({
        to: to as never,
        params: params as never,
        search: search as never,
        replace,
      })
      .finally(() => {
        setTimeout(() => {
          navigating.current = false;
        }, 400);
      });
  }

  function onTouchStart(e: TouchEvent<HTMLButtonElement>) {
    if (disabled) return;
    try {
      void router.preloadRoute({
        to: to as never,
        params: params as never,
        search: search as never,
      } as never);
    } catch {
      /* soft */
    }
    void e;
  }

  return (
    <button
      type="button"
      disabled={disabled}
      className={className}
      style={{
        appearance: "none",
        WebkitAppearance: "none",
        display: "flex",
        boxSizing: "border-box",
        touchAction: "manipulation",
        WebkitTapHighlightColor: "transparent",
        ...style,
      }}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || disabled) return;
        e.stopPropagation();
        go();
      }}
      onTouchStart={onTouchStart}
      onContextMenu={(e) => e.preventDefault()}
      draggable={false}
      {...rest}
    >
      {children}
    </button>
  );
}
