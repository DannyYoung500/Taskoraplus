/**
 * Real crypto brand marks for deposit / withdraw.
 * Brand colors match official assets (USDT green, BTC orange, TON blue, BNB gold).
 */
import type { CSSProperties } from "react";
import * as React from "react";

export type CryptoId = "usdt" | "btc" | "ton" | "bnb" | "eth";

export type CryptoMeta = {
  id: CryptoId;
  label: string;
  networkHint: string;
  color: string;
  /** Hex for solid logo tile */
  tile: string;
};

export const CRYPTO_META: Record<CryptoId, CryptoMeta> = {
  usdt: {
    id: "usdt",
    label: "USDT",
    networkHint: "Tether",
    color: "#26A17B",
    tile: "#26A17B",
  },
  btc: {
    id: "btc",
    label: "Bitcoin",
    networkHint: "BTC",
    color: "#F7931A",
    tile: "#F7931A",
  },
  ton: {
    id: "ton",
    label: "TON",
    networkHint: "The Open Network",
    color: "#0098EA",
    tile: "#0098EA",
  },
  bnb: {
    id: "bnb",
    label: "BNB",
    networkHint: "BEP20 / BSC",
    color: "#F0B90B",
    tile: "#F0B90B",
  },
  eth: {
    id: "eth",
    label: "Ethereum",
    networkHint: "ERC20",
    color: "#627EEA",
    tile: "#627EEA",
  },
};

/** Map wallet method strings → crypto id */
export function resolveCryptoId(method: string): CryptoId {
  const m = method.toLowerCase();
  if (m.includes("btc") || m.includes("bitcoin")) return "btc";
  if (m.includes("ton")) return "ton";
  if (m.includes("bnb") || m.includes("bep20") || m.includes("bsc")) return "bnb";
  if (m.includes("eth") || m.includes("erc20")) return "eth";
  return "usdt";
}

function UsdtMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="16" fill="#26A17B" />
      <path
        fill="#fff"
        d="M17.922 17.383v-.002c-.11.008-.677.042-1.942.042-1.01 0-1.721-.03-1.967-.042v.003c-3.888-.171-6.79-.848-6.79-1.658 0-.809 2.902-1.486 6.79-1.66v2.644c.254.018.982.061 1.988.061 1.207 0 1.812-.05 1.922-.06v-2.643c3.88.173 6.775.85 6.775 1.658 0 .81-2.895 1.485-6.776 1.657m0-3.59v-2.366h5.414V7.819H8.595v3.608h5.414v2.365c-4.4.202-7.709 1.074-7.709 2.118 0 1.044 3.309 1.915 7.709 2.118v7.582h3.913v-7.584c4.393-.202 7.694-1.073 7.694-2.116 0-1.043-3.301-1.914-7.694-2.117"
      />
    </svg>
  );
}

function BtcMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="16" fill="#F7931A" />
      <path
        fill="#fff"
        d="M22.5 14.1c.3-2-1.2-3.1-3.3-3.8l.7-2.7-1.6-.4-.7 2.6c-.4-.1-.9-.2-1.3-.3l.7-2.7-1.6-.4-.7 2.7c-.3-.1-.7-.2-1-.3l-2.2-.5-.4 1.7s1.2.3 1.1.3c.6.2.8.6.7 1l-.7 2.9c.1 0 .1 0 .2.1h-.2l-1 4.1c-.1.2-.3.5-.7.4 0 0-1.1-.3-1.1-.3l-.7 1.9 2.1.5c.4.1.8.2 1.1.3l-.7 2.8 1.6.4.7-2.7c.4.1.9.2 1.3.3l-.7 2.7 1.6.4.7-2.8c2.9.5 5.1.3 6-.2 1.2-.7 1.7-1.9 1.5-3.4-.1-1.1-.9-1.8-1.9-2.2.8-.2 1.5-.8 1.7-1.9m-3 4.3c.2 1.6-2.5 1.8-3.3 2l.6-2.4c.8-.2 3.4-.6 2.7 1.4m.3-4.3c.2 1.5-2.1 1.6-2.7 1.8l.5-2.2c.7-.1 2.9-.5 2.2 1.4"
      />
    </svg>
  );
}

function TonMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="16" fill="#0098EA" />
      <path
        fill="#fff"
        d="M22.5 10.4 16.6 23.2h-1.5L9.2 10.4h2.1l4.5 9.7 4.5-9.7h2.2z"
      />
    </svg>
  );
}

function BnbMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="16" fill="#F0B90B" />
      <path
        fill="#fff"
        d="M16 7.5 13.2 10.3l2.8 2.8 2.8-2.8L16 7.5zm-5.6 5.6L7.5 16l2.9 2.9 2.8-2.9-2.8-2.9zm11.2 0-2.8 2.9 2.8 2.9L24.5 16l-2.9-2.9zM16 16.9l-2.8 2.8 2.8 2.8 2.8-2.8-2.8-2.8zm0 5.6-2.8 2.8L16 28.1l2.8-2.8L16 22.5z"
      />
    </svg>
  );
}

function EthMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="16" fill="#627EEA" />
      <path fill="#fff" fillOpacity="0.6" d="M16.5 6v7.5l6.3 2.8L16.5 6z" />
      <path fill="#fff" d="M16.5 6 10 16.3l6.5-2.8V6z" />
      <path fill="#fff" fillOpacity="0.6" d="M16.5 21.9v4.1l6.3-8.7-6.3 4.6z" />
      <path fill="#fff" d="M16.5 26v-4.1L10 17.3 16.5 26z" />
      <path fill="#fff" fillOpacity="0.2" d="M16.5 20.5 22.8 16.3 16.5 13.5v7z" />
      <path fill="#fff" fillOpacity="0.6" d="M10 16.3l6.5 4.2v-7L10 16.3z" />
    </svg>
  );
}

const MARKS: Record<CryptoId, (p: { size: number }) => React.ReactElement> = {
  usdt: UsdtMark,
  btc: BtcMark,
  ton: TonMark,
  bnb: BnbMark,
  eth: EthMark,
};

export function CryptoIcon({
  id,
  size = 36,
  className,
}: {
  id: CryptoId | string;
  size?: number;
  className?: string;
}) {
  const key = (typeof id === "string" && id in CRYPTO_META ? id : resolveCryptoId(String(id))) as CryptoId;
  const Mark = MARKS[key] ?? UsdtMark;
  return (
    <span
      className={className}
      style={{ width: size, height: size, display: "inline-flex", lineHeight: 0 } as CSSProperties}
      aria-label={CRYPTO_META[key]?.label ?? "Crypto"}
      role="img"
    >
      <Mark size={size} />
    </span>
  );
}

export function CryptoLogo({
  method,
  size = 40,
}: {
  method: string;
  size?: number;
}) {
  const id = resolveCryptoId(method);
  const meta = CRYPTO_META[id];
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-2xl shadow-md ring-1 ring-white/15"
      style={{ width: size, height: size }}
      title={`${meta.label} · ${meta.networkHint}`}
    >
      <CryptoIcon id={id} size={size} />
    </span>
  );
}
