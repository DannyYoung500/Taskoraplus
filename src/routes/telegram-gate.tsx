import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { CheckCircle2, AlertTriangle, Loader2, UserPlus } from "lucide-react";
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
  username?: string | null;
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
    requiredChats: Array<{
      id: string;
      name: string;
      url: string;
      photoUrl?: string | null;
      username?: string | null;
    }>;
  } | null>(null);

  useEffect(() => {
    void check(false);
  }, []);

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
            username: c.username ?? null,
          })),
        });
      }

      if ("checkedChats" in result && Array.isArray(result.checkedChats)) {
        setChecked(
          (result.checkedChats as Checked[]).map((c) => ({
            ...c,
            username: (c as any).username ?? null,
          })),
        );
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
      setMessage(result.settings?.failureMessage ?? "Join every required community to continue.");
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

  const title = settings?.title ?? "JOIN OUR CHANNELS";
  const description =
    settings?.description ?? "Join every required community below to unlock TASKORA and start earning.";

  const communities =
    checked.length > 0
      ? checked.map((c) => ({
          id: c.id,
          name: c.name,
          url: c.url,
          photoUrl: c.photoUrl,
          username: c.username,
          allowed: c.allowed,
          status: c.status,
        }))
      : (settings?.requiredChats ?? []).map((c) => ({
          id: c.id,
          name: c.name,
          url: c.url,
          photoUrl: c.photoUrl,
          username: c.username,
          allowed: false,
          status: "unknown",
        }));

  const allJoined =
    communities.length > 0 &&
    communities.every(
      (c) =>
        c.allowed ||
        c.status === "member" ||
        c.status === "administrator" ||
        c.status === "creator",
    );

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-md flex-col overflow-hidden bg-[#0b0e1a] text-white">
      {/* Header — no cancel/close; gate is mandatory */}
      <header className="flex items-center justify-center px-4 pt-4 pb-2">
        <p className="text-sm font-semibold tracking-[0.2em] text-white/90">TASKORA</p>
      </header>

      <div className="flex flex-1 flex-col items-center px-5 pb-8 pt-4">
        <img
          src={TASKORA_LOGO}
          alt="TASKORA"
          className="mb-4 size-14 rounded-full object-cover shadow-[0_0_32px_rgba(59,130,246,0.4)]"
        />

        <h1 className="text-center text-[22px] font-extrabold tracking-wide text-sky-300">
          {title}
        </h1>
        <p className="mt-2 max-w-xs text-center text-[13px] leading-relaxed text-white/50">
          {description}
        </p>

        <div className="mt-5 w-full">
          {phase === "checking" ? (
            <StatusBanner
              icon={<Loader2 className="size-4 animate-spin text-sky-300" />}
              text="Checking membership…"
            />
          ) : null}
          {phase === "verified" ? (
            <StatusBanner
              icon={<CheckCircle2 className="size-4 text-emerald-400" />}
              text={settings?.successMessage ?? "Membership verified — unlocking…"}
            />
          ) : null}
          {phase === "unavailable" ? (
            <StatusBanner
              icon={<AlertTriangle className="size-4 text-amber-300" />}
              text={message ?? "Verification temporarily unavailable"}
            />
          ) : null}
        </div>

        <div className="mt-5 w-full space-y-3">
          {communities.length === 0 && phase !== "checking" ? (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-8 text-center text-sm text-white/40">
              No communities configured yet.
            </div>
          ) : (
            communities.map((c) => {
              const joined =
                c.allowed ||
                c.status === "member" ||
                c.status === "administrator" ||
                c.status === "creator";
              const handle =
                c.username
                  ? `@${String(c.username).replace(/^@/, "")}`
                  : c.url?.includes("t.me/")
                    ? `@${c.url.split("t.me/")[1]?.split(/[/?]/)[0] ?? ""}`
                    : "";

              return (
                <div
                  key={c.id || c.name}
                  className="flex items-center gap-3 rounded-[18px] border border-white/10 bg-[#161b2e] px-3.5 py-3 shadow-[0_4px_24px_rgba(0,0,0,0.35)]"
                >
                  {c.photoUrl ? (
                    <img
                      src={c.photoUrl}
                      alt=""
                      className="size-12 shrink-0 rounded-full object-cover ring-2 ring-sky-400/30"
                    />
                  ) : (
                    <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-sky-500/20 text-sm font-bold text-sky-300">
                      {(c.name || "T").slice(0, 2).toUpperCase()}
                    </span>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold leading-tight">{c.name}</p>
                    {handle ? (
                      <p className="mt-0.5 truncate text-[12px] text-white/40">{handle}</p>
                    ) : (
                      <p className="mt-0.5 text-[11px] text-white/35">
                        {joined ? "✓ Member" : "Required"}
                      </p>
                    )}
                  </div>

                  {joined ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1.5 text-[11px] font-bold text-emerald-300">
                      ✓ Joined
                    </span>
                  ) : c.url ? (
                    <button
                      type="button"
                      onClick={() => openUrl(c.url)}
                      className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#2AABEE] px-3.5 py-2 text-[12px] font-bold text-white shadow-[0_0_16px_rgba(42,171,238,0.35)] active:scale-95"
                    >
                      <UserPlus className="size-3.5" />
                      JOIN
                    </button>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        {phase !== "verified" ? (
          <div className="mt-6 w-full space-y-2">
            <button
              type="button"
              disabled={phase === "checking"}
              onClick={() => void check(true)}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-sky-400 px-4 py-4 text-[15px] font-extrabold text-[#0b0e1a] shadow-[0_0_28px_rgba(56,189,248,0.35)] active:scale-[0.98] disabled:opacity-60"
            >
              {phase === "checking" ? (
                <>
                  <Loader2 className="size-5 animate-spin" />
                  Checking…
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-5" />
                  {allJoined ? "CONTINUE" : settings?.checkButtonText ?? "CONTINUE"}
                </>
              )}
            </button>
            <p className="text-center text-[11px] text-white/35">
              After joining every community, tap Continue
            </p>
          </div>
        ) : null}

        {phase === "not_member" && message ? (
          <p className="mt-3 text-center text-xs text-amber-200/70">{message}</p>
        ) : null}
      </div>
    </main>
  );
}

function StatusBanner({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-[12px] text-white/70">
      {icon}
      <span>{text}</span>
    </div>
  );
}
