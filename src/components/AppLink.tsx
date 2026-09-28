/**
 * Internal navigation without <a href>.
 * Telegram long-press on real links shows “Open link” with the URL —
 * AppLink uses a <button> + router.navigate so that sheet never appears.
 * External https:// links should stay as normal <a>.
 */
import { useRouter } from "@tanstack/react-router";
import type { CSSProperties, MouseEvent, ReactNode } from "react";

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

  return (
    <button
      type="button"
      disabled={disabled}
      className={className}
      style={style}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || disabled) return;
        void router.navigate({
          to: to as never,
          params: params as never,
          search: search as never,
          replace,
        });
      }}
      onContextMenu={(e) => e.preventDefault()}
      draggable={false}
      {...rest}
    >
      {children}
    </button>
  );
}
