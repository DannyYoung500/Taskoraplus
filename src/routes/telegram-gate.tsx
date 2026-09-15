import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Lock, CheckCircle2, AlertTriangle, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getTelegramGateStatus } from "@/lib/telegram-gate.functions";
import { TASKORA_LOGO } from "@/lib/brand";

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        openTelegramLink?: (url: string) => void;
        openLink?: (url: string) => void;
      };
    };
  }
}

export const Route = createFileRoute("/telegram-gate")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) {
      throw new Error("Open TASKORA from Telegram.");
    }
  },
  component: TelegramGateScreen,
});

type Phase = "locked" | "checking" | "verified" | "not_member" | "unavailable";

type Checked = {
  id: string;
  name: string;
  url: string;
  status: string;
  allowed: boolean;
  photoUrl?: string | null;
};

function TelegramGateScreen() {
  const navigate = useNavigate();
  const [phase, setPhase] = useState<Phase>("locked");
  const [message, setMessage] = useState<string | null>(null);
  const [checked, setChecked] = useState<Checked[]>([]);
  const [settings, setSettings] = useState<{
    title: string;
    description: string;
    joinButtonText: string;
    checkButtonText: string;
    successMessage: string;
    failureMessage: string;
    requiredChats: Array<{ id: string; name: string; url: string; photoUrl?: string | null }>;
  } | null>(null);

  async function check(force = true) {
    setPhase("checking");
    setMessage(null);
    try {
      const initData = window.Telegram?.WebApp?.initData ?? "";
      if (!initData) {
        setPhase("unavailable");
        setMessage("Open TASKORA from @Taskoraplusbot inside Telegram.");
        return;
      }
      const result = await getTelegramGateStatus({ data: { initData, force } });

      if (result.settings) {
        setSettings({
          title: result.settings.title,
          description: result.settings.description,
          joinButtonText: result.settings.joinButtonText,
          checkButtonText: result.settings.checkButtonText,
          successMessage: result.settings.successMessage,
          failureMessage: result.settings.failureMessage,
          requiredChats: (result.settings.requiredChats ?? []).map((c) => ({
            id: c.id,
            name: c.name || c.id,
            url: c.url || (c.username ? `https://t.me/${c.username}` : ""),
            photoUrl: c.photoUrl ?? null,
          })),
        });
      }

      if ("checkedChats" in result && Array.isArray(result.checkedChats)) {
        setChecked(result.checkedChats as Checked[]);
      }

      if (result.allowed) {
        setPhase("verified");
        window.setTimeout(() => navigate({ to: "/home", replace: true }), 1400);
        return;
      }

      if ("temporaryError" in result && result.temporaryError) {
        setPhase("unavailable");
        setMessage(String(result.temporaryError));
        return;
      }

      setPhase("not_member");
      setMessage(result.settings?.failureMessage ?? "You must join every required community.");
    } catch (e) {
      setPhase("unavailable");
      setMessage(e instanceof Error ? e.message : "Verification temporarily unavailable.");
    }
  }

  function openUrl(url: string) {
    const u = url?.trim();
    if (!u) return;
    try {
      if (window.Telegram?.WebApp?.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(u);
      } else if (window.Telegram?.WebApp?.openLink) {
        window.Telegram.WebApp.openLink(u);
      } else {
        window.open(u, "_blank");
      }
    } catch {
      window.open(u, "_blank");
    }
  }

  const title = settings?.title ?? "TASKORA ACCESS LOCKED";
  const description =
    settings?.description ?? "Join every required Telegram community to continue.";

  const communities =
    checked.length > 0
      ? checked.map((c) => ({
          id: c.id,
          name: c.name,
          url: c.url,
          photoUrl: c.photoUrl,
          allowed: c.allowed,
          status: c.status,
        }))
      : (settings?.requiredChats ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          url: c.url,
          photoUrl: c.photoUrl,
          allowed: false,
          status: "unknown",
        }));

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center overflow-hidden bg-[#0b1424] px-5 py-8 text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 15%, rgba(42,171,238,0.16), transparent 50%), radial-gradient(ellipse at 50% 100%, rgba(59,130,246,0.08), transparent 40%)",
        }}
      />

      <div className="relative z-10 w-full">
        <div className="mb-5 flex flex-col items-center">
          <img
            src={TASKORA_LOGO}
            alt="TASKORA"
            className="size-16 rounded-full object-cover shadow-[0_0_28px_rgba(42,171,238,0.35)]"
          />
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-blue-300/80">TASKORA</p>
          <h1 className="mt-2 text-center text-xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-2 max-w-sm text-center text-xs leading-relaxed text-white/50">{description}</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-[#121f33]/95 p-5 backdrop-blur">
          {phase === "locked" || phase === "not_member" ? (
            <Status
              icon={<Lock className="size-5 text-sky-300" />}
              label="ACCESS LOCKED"
              detail="You must be a member of every required community"
            />
          ) : null}
          {phase === "checking" ? (
            <Status
              icon={<Loader2 className="size-5 animate-spin text-sky-300" />}
              label="CHECKING TELEGRAM MEMBERSHIP…"
              detail="Verifying each required community"
            />
          ) : null}
          {phase === "verified" ? (
            <Status
              icon={<CheckCircle2 className="size-5 text-emerald-400" />}
              label="MEMBERSHIP VERIFIED"
              detail={settings?.successMessage ?? "TASKORA unlocked."}
            />
          ) : null}
          {phase === "unavailable" ? (
            <Status
              icon={<AlertTriangle className="size-5 text-amber-200" />}
              label="VERIFICATION TEMPORARILY UNAVAILABLE"
              detail={message ?? "Please try again shortly."}
            />
          ) : null}

          {communities.length > 0 ? (
            <div className="mt-4 space-y-2">
              {communities.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 rounded-2xl border border-white/8 bg-black/25 px-3 py-2.5"
                >
                  {c.photoUrl ? (
                    <img src={c.photoUrl} alt="" className="size-10 rounded-full object-cover" />
                  ) : (
                    <span className="inline-flex size-10 items-center justify-center rounded-full bg-sky-500/15 text-sky-300 text-xs font-bold">
                      TG
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{c.name}</p>
                    <p className="text-[10px] text-white/40">
                      {c.allowed || c.status === "member" || c.status === "administrator" || c.status === "creator"
                        ? "✓ Member"
                        : c.status === "error"
                          ? "Could not verify"
                          : "Not a member yet"}
                    </p>
                  </div>
                  {c.url ? (
                    <button
                      type="button"
                      onClick={() => openUrl(c.url)}
                      className="inline-flex items-center gap-1 rounded-xl bg-[#2AABEE] px-2.5 py-1.5 text-[10px] font-bold text-white"
                    >
                      JOIN <ExternalLink className="size-3" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {phase === "not_member" && message ? (
            <p className="mt-3 text-center text-xs text-white/45">{message}</p>
          ) : null}

          {phase !== "verified" && phase !== "checking" ? (
            <div className="mt-5 space-y-2.5">
              <button
                type="button"
                onClick={() => void check(true)}
                className="w-full rounded-2xl border border-sky-400/40 bg-sky-400/10 px-4 py-3.5 text-sm font-bold text-sky-100"
              >
                {settings?.checkButtonText ?? "✓ CHECK MEMBERSHIP"}
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}

function Status({ icon, label, detail }: { icon: ReactNode; label: string; detail: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-3 inline-flex size-12 items-center justify-center rounded-2xl bg-white/5">{icon}</div>
      <p className="text-sm font-bold tracking-wide">{label}</p>
      <p className="mt-1 text-xs text-white/45">{detail}</p>
    </div>
  );
}
