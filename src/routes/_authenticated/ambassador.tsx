import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Share2, Users, Crown } from "lucide-react";
import { Screen, ScreenTitle, Card, GoldButton } from "@/components/Screen";
import { getDashboard, applyReferral } from "@/lib/taskora.functions";

export const Route = createFileRoute("/_authenticated/ambassador")({
  loader: async () => {
    const dash = await getDashboard().catch(() => null);
    return { dash };
  },
  head: () => ({ meta: [{ title: "Invite — TASKORA" }] }),
  component: AmbassadorScreen,
});

const TIERS = [
  { name: "Starter", need: "0 invites", rate: "5%" },
  { name: "Rising", need: "10 invites", rate: "8%" },
  { name: "Ambassador", need: "25 invites", rate: "12%" },
  { name: "Elite", need: "100 invites", rate: "18%" },
];

const TELEGRAM_BOT_USERNAME = "Taskoraplusbot";
const TELEGRAM_MINI_APP_SHORT_NAME = "taskora";

function AmbassadorScreen() {
  const { dash } = Route.useLoaderData();
  const code = dash?.profile?.referral_code ?? "—";
  const telegramId = dash?.telegramId ?? null;
  const referrals = dash?.referrals ?? 0;
  const referralLink = telegramId
    ? `https://t.me/${TELEGRAM_BOT_USERNAME}/${TELEGRAM_MINI_APP_SHORT_NAME}?startapp=${encodeURIComponent(String(telegramId))}`
    : "";
  const [inviteCode, setInviteCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  async function applyCode() {
    setMsg(null);
    try {
      await applyReferral({ data: { code: inviteCode } });
      setMsg("Invite applied.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Could not apply code");
    }
  }

  return (
    <Screen>
      <ScreenTitle title="Invite & earn" subtitle="5% of eligible referred earnings (economy setting)" />

      <section
        className="rounded-3xl border border-amber-400/25 p-5"
        style={{
          background:
            "radial-gradient(ellipse at 80% 0%, rgba(245,197,66,0.22), transparent 55%), linear-gradient(160deg,#161820,#0a0c12)",
        }}
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
          <Crown className="size-3.5" /> Ambassador
        </span>
        <p className="mt-3 text-3xl font-extrabold text-amber-300">{referrals} invites</p>
        <p className="mt-1 text-xs text-white/50">Share verified rewards on referrals</p>
      </section>

      <Card className="mt-4 p-4">
        <p className="text-xs text-white/45">Your referral link</p>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 truncate rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-bold tracking-wide">
            {referralLink || "Telegram session required"}
          </code>
          <button
            type="button"
            aria-label="Copy referral link"
            disabled={!referralLink}
            onClick={() => {
              if (referralLink) void navigator.clipboard?.writeText(referralLink);
            }}
            className="inline-flex size-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 disabled:opacity-40"
          >
            <Copy className="size-4 text-amber-300" />
          </button>
        </div>
        <p className="mt-2 text-[11px] text-white/35">
          Your Telegram user ID is used as the referral start parameter.
        </p>
        <GoldButton
          className="mt-3"
          disabled={!referralLink}
          onClick={() => {
            if (!referralLink) return;
            const text = "Join me on TASKORA and earn rewards.";
            const url = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(text)}`;
            window.open(url, "_blank");
          }}
        >
          <span className="inline-flex items-center justify-center gap-2">
            <Share2 className="size-4" /> Share referral link
          </span>
        </GoldButton>
      </Card>

      <Card className="mt-4 space-y-2 p-4">
        <p className="text-sm font-semibold">Have an invite code?</p>
        <input
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          placeholder="TASKORA-XXXXXX"
          className="w-full rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm outline-none focus:border-amber-300/40"
        />
        <button
          type="button"
          onClick={() => void applyCode()}
          className="w-full rounded-2xl border border-white/15 py-3 text-sm font-semibold text-white/80"
        >
          Apply code
        </button>
        {msg ? <p className="text-xs text-white/50">{msg}</p> : null}
      </Card>

      <section className="mt-6">
        <h2 className="mb-3 text-base font-bold">Reward tiers</h2>
        <Card className="divide-y divide-white/8">
          {TIERS.map((t) => (
            <div key={t.name} className="flex items-center gap-3 p-3.5">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-amber-400/12">
                <Users className="size-4 text-amber-300" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-[11px] text-white/40">{t.need}</p>
              </div>
              <p className="text-sm font-bold text-amber-300">{t.rate}</p>
            </div>
          ))}
        </Card>
      </section>
    </Screen>
  );
}
