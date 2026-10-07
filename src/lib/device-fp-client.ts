/**
 * Client-only composite device fingerprint (no PII).
 * Combines canvas noise, screen, timezone, language, DPR, platform.
 * Safe to run in Telegram WebView.
 */

function canvasNoise(): string {
  try {
    const c = document.createElement("canvas");
    c.width = 120;
    c.height = 40;
    const ctx = c.getContext("2d");
    if (!ctx) return "no-canvas";
    ctx.textBaseline = "top";
    ctx.font = "14px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 120, 40);
    ctx.fillStyle = "#069";
    ctx.fillText("TASKORA-fp", 4, 8);
    ctx.strokeStyle = "#ff0";
    ctx.beginPath();
    ctx.arc(60, 20, 12, 0, Math.PI * 2);
    ctx.stroke();
    return c.toDataURL().slice(-48);
  } catch {
    return "canvas-err";
  }
}

/** Sync fingerprint string (use with reportDeviceFpV2). */
export function collectDeviceFpV2(): string {
  if (typeof window === "undefined") return "ssr";
  const parts = [
    canvasNoise(),
    String(screen?.width ?? 0),
    String(screen?.height ?? 0),
    String(screen?.colorDepth ?? 0),
    String(window.devicePixelRatio ?? 1),
    Intl.DateTimeFormat().resolvedOptions().timeZone || "tz",
    navigator.language || "",
    navigator.platform || "",
    String(navigator.maxTouchPoints ?? 0),
    String(navigator.hardwareConcurrency ?? 0),
  ];
  return parts.join("|");
}

/** Simple non-crypto hash for compact storage (server also hashes). */
export function hashFpLocal(raw: string): string {
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
