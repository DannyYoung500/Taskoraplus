/** Telegram WebApp native helpers — haptics + MainButton */

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        HapticFeedback?: {
          impactOccurred?: (style: "light" | "medium" | "heavy" | "rigid" | "soft") => void;
          notificationOccurred?: (type: "error" | "success" | "warning") => void;
          selectionChanged?: () => void;
        };
        MainButton?: {
          text: string;
          isVisible: boolean;
          isActive: boolean;
          setText: (t: string) => void;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
          onClick: (cb: () => void) => void;
          offClick: (cb: () => void) => void;
          setParams: (p: {
            text?: string;
            color?: string;
            text_color?: string;
            is_active?: boolean;
            is_visible?: boolean;
          }) => void;
        };
        ready?: () => void;
        expand?: () => void;
      };
    };
  }
}

export function hapticSuccess() {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
  } catch {
    /* ignore */
  }
}

export function hapticError() {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("error");
  } catch {
    /* ignore */
  }
}

export function hapticLight() {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
  } catch {
    /* ignore */
  }
}

export function hapticSelection() {
  try {
    window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
  } catch {
    /* ignore */
  }
}

type MainBtnHandler = () => void;
let boundHandler: MainBtnHandler | null = null;

export function showMainButton(text: string, onClick: MainBtnHandler) {
  const mb = window.Telegram?.WebApp?.MainButton;
  if (!mb) return;
  try {
    if (boundHandler) mb.offClick(boundHandler);
    boundHandler = onClick;
    mb.setText(text);
    mb.onClick(onClick);
    mb.show();
    mb.enable();
  } catch {
    /* ignore */
  }
}

export function hideMainButton() {
  const mb = window.Telegram?.WebApp?.MainButton;
  if (!mb) return;
  try {
    if (boundHandler) mb.offClick(boundHandler);
    boundHandler = null;
    mb.hide();
  } catch {
    /* ignore */
  }
}
