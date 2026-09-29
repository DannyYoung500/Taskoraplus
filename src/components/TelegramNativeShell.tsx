import { useEffect } from "react";

type TelegramWebApp = {
  ready?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  setBottomBarColor?: (color: string) => void;
  addToHomeScreen?: () => void;
  checkHomeScreenStatus?: (cb: (status: string) => void) => void;
  enableVerticalSwipes?: () => void;
  onEvent?: (event: string, callback: (data?: Record<string, number>) => void) => void;
  offEvent?: (event: string, callback: (data?: Record<string, number>) => void) => void;
  isActive?: boolean;
  viewportHeight?: number;
  viewportStableHeight?: number;
  isFullscreen?: boolean;
  performanceClass?: "LOW" | "AVERAGE" | "HIGH";
  themeParams?: Record<string, string | undefined>;
  HapticFeedback?: {
    impactOccurred?: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
    notificationOccurred?: (type: "error" | "success" | "warning") => void;
    selectionChanged?: () => void;
  };
  BackButton?: {
    show?: () => void;
    hide?: () => void;
    onClick?: (callback: () => void) => void;
    offClick?: (callback: () => void) => void;
  };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

function setViewportVars(tg: TelegramWebApp) {
  const root = document.documentElement;
  const stable = tg.viewportStableHeight ?? tg.viewportHeight;
  if (typeof stable === "number" && stable > 0) {
    root.style.setProperty("--tg-viewport-stable-height", `${stable}px`);
  }
  root.dataset.telegramPerformance = tg.performanceClass ?? "UNKNOWN";
}

function syncTheme(tg: TelegramWebApp) {
  const root = document.documentElement;
  const theme = tg.themeParams ?? {};
  for (const [key, value] of Object.entries(theme)) {
    if (value) root.style.setProperty(`--tg-theme-${key}`, value);
  }
}

function syncSafeArea(data?: Record<string, number>) {
  const root = document.documentElement;
  root.style.setProperty("--tg-safe-top", "env(safe-area-inset-top, 0px)");
  root.style.setProperty("--tg-safe-right", "env(safe-area-inset-right, 0px)");
  root.style.setProperty("--tg-safe-bottom", "env(safe-area-inset-bottom, 0px)");
  root.style.setProperty("--tg-safe-left", "env(safe-area-inset-left, 0px)");
  if (data) {
    root.style.setProperty("--tg-content-safe-top", `${data.top ?? 0}px`);
    root.style.setProperty("--tg-content-safe-right", `${data.right ?? 0}px`);
    root.style.setProperty("--tg-content-safe-bottom", `${data.bottom ?? 0}px`);
    root.style.setProperty("--tg-content-safe-left", `${data.left ?? 0}px`);
  }
}

export function TelegramNativeShell() {
  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;

    const initialize = () => {
      if (disposed) return;
      const tg = window.Telegram?.WebApp;
      if (!tg) {
        retryTimer = setTimeout(initialize, 100);
        return;
      }

      const handleViewport = () => setViewportVars(tg);
    const handleTheme = () => syncTheme(tg);
    const syncBackButton = () => {
      const back = tg.BackButton;
      if (!back?.show || !back.hide || !back.onClick) return;
      if (window.history.length > 1) {
        try {
          back.show();
          back.onClick(goBack);
        } catch {}
      } else {
        try { back.hide(); } catch {}
      }
    };
    const goBack = () => {
      if (window.history.length > 1) window.history.back();
    };

    try {
      // Keep the Mini App compact: intentionally do not call expand() or requestFullscreen().
      tg.ready?.();
      tg.setHeaderColor?.("#030814");
      tg.setBackgroundColor?.("#030814");
      tg.setBottomBarColor?.("#030814");
      tg.enableVerticalSwipes?.();

      syncSafeArea();
      syncTheme(tg);
      setViewportVars(tg);

      tg.onEvent?.("viewportChanged", handleViewport);
      tg.onEvent?.("themeChanged", handleTheme);
      tg.onEvent?.("safeAreaChanged", syncSafeArea);
      tg.onEvent?.("contentSafeAreaChanged", syncSafeArea);
      window.addEventListener("popstate", syncBackButton);
      syncBackButton();

      if (tg.performanceClass === "LOW") {
        document.documentElement.dataset.telegramLowPerformance = "true";
      } else {
        delete document.documentElement.dataset.telegramLowPerformance;
      }
    } catch {
      // Telegram APIs are optional; browser/PWA usage continues normally.
    }

      return () => {
        tg.offEvent?.("viewportChanged", handleViewport);
      tg.offEvent?.("themeChanged", handleTheme);
      tg.offEvent?.("safeAreaChanged", syncSafeArea);
      tg.offEvent?.("contentSafeAreaChanged", syncSafeArea);
      window.removeEventListener("popstate", syncBackButton);
      try {
        tg.BackButton?.offClick?.(goBack);
        tg.BackButton?.hide?.();
        } catch {}
      };
    };

    initialize();
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, []);

  return null;
}

export function addTaskoraToHomeScreen() {
  try {
    window.Telegram?.WebApp?.addToHomeScreen?.();
  } catch {}
}

export function checkTaskoraHomeScreen(cb: (status: string) => void) {
  try {
    window.Telegram?.WebApp?.checkHomeScreenStatus?.(cb);
  } catch {
    cb("unsupported");
  }
}

export function taskoraHaptic(
  style: "light" | "medium" | "heavy" | "rigid" | "soft" = "light",
) {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.(style);
  } catch {}
}

export function taskoraHapticNotification(type: "error" | "success" | "warning") {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.(type);
  } catch {}
}

export function taskoraShowBackButton(onBack: () => void) {
  const back = window.Telegram?.WebApp?.BackButton;
  if (!back?.show || !back.onClick) return () => {};
  try {
    back.onClick(onBack);
    back.show();
    return () => {
      back.offClick?.(onBack);
      back.hide?.();
    };
  } catch {
    return () => {};
  }
}
