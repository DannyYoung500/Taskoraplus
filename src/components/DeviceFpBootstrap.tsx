import { useEffect } from "react";

/** Mount once under authenticated layout — reports composite device FP. */
export function DeviceFpBootstrap() {
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { collectDeviceFpV2 } = await import("@/lib/device-fp-client");
        const { reportDeviceFpV2 } = await import("@/lib/strong-remaining.functions");
        if (cancelled) return;
        await reportDeviceFpV2({ data: { rawFp: collectDeviceFpV2() } });
      } catch {
        /* never block UI */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
