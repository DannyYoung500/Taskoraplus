import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Share2, Users, Trophy } from "lucide-react";
import { Screen, ScreenTitle, Card, GoldButton } from "@/components/Screen";
import { getDashboard, applyReferral } from "@/lib/taskora.functions";

export const Route = createFileRoute("/_authenticated/ambassador")({
  loader: async () => {
    const dash = await getDashboard().catch(() => null);
    return { dash };
  },
  head: () => ({ meta: [{ title: "Referral — TASKORA" }] }),
  component: ReferralScreen,
});

const MILESTONES = [
  { need: 5, points: 250 },
  { need: 10, points: 500 },
  { need: 25, points: 1000 },
  { need: 50, points: 2000 },
  { need: 100, points: 4000 },
  { need: 250, points: 7500 },
  { need: 500, points: 12500 },
  { need: 1000, points: 20000 },
  { need: 2500, points: 35000 },
  { need: 5000, points: 60000 },
  { need: 10000, points: 100000 },
  { need: 25000, points: 175000 },
  { need: 50000, points: 300000 },
  { need: 100000, points: 500000 },
];

const TELEGRAM_BOT_USERNAME = "Taskoraplusbot";

function ReferralScreen() {
  const { dash } = Route.useLoaderData();
  const telegramId = dash?.telegramId ?? null;
  const referrals = dash?.referrals ?? 0;
  const referralLink = telegramId
    ? `https://t.me/${TELEGRAM_BOT_USERNAME}/?startapp=${encodeURIComponent(String(telegramId))}`
    : "";
  const [inviteCode, setInviteCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const nextMilestone = MILESTONES.find((milestone) => referrals < milestone.need);
  const previousNeed = MILESTONES[MILESTONES.findIndex((milestone) => milestone === nextMilestone) - 1]?.need ?? 0;
  const progress = nextMilestone
    ? Math.min(100, Math.max(0, ((referrals - previousNeed) / (nextMilestone.need - previousNeed)) * 100))
    : 100;

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
      <ScreenTitle title="Referral" subtitle="Invite friends and earn Task Points from eligible referrals." />

      <section
        className="rounded-3xl border border-amber-400/25 p-5"
        style={{
          background:
            "radial-gradient(ellipse at 80% 0%, rgba(245,197,66,0.22), transparent 55%), linear-gradient(160deg,#161820,#0a0c12)",
        }}
      >
        <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold text-amber-300">
          <Trophy className="size-3.5" /> Task Points
        </span>
        <p className="mt-3 text-3xl font-extrabold text-amber-300">{referrals} referrals</p>
        <p className="mt-1 text-xs text-white/50">Successful referrals count toward milestones</p>
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
            const text = "Join me on TASKORA and earn Task Points.";
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
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Referral milestones</h2>
            <p className="mt-1 text-[11px] text-white/40">Higher milestones require more successful referrals.</p>
          </div>
          {nextMilestone ? (
            <p className="shrink-0 text-right text-[11px] text-amber-300">
              {nextMilestone.need - referrals} to go
            </p>
          ) : (
            <p className="shrink-0 text-right text-[11px] text-amber-300">All milestones complete</p>
          )}
        </div>

        {nextMilestone ? (
          <Card className="mb-3 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Next milestone: {nextMilestone.need.toLocaleString()} referrals</p>
                <p className="mt-1 text-xs text-white/40">Reward: +{nextMilestone.points.toLocaleString()} Task Points</p>
              </div>
              <Users className="size-5 text-amber-300" />
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full bg-amber-300" style={{ width: `${progress}%` }} />
            </div>
          </Card>
        ) : null}

        <Card className="divide-y divide-white/8">
          {MILESTONES.map((milestone) => {
            const complete = referrals >= milestone.need;
            return (
              <div key={milestone.need} className="flex items-center gap-3 p-3.5">
                <span className={`inline-flex size-9 items-center justify-center rounded-full ${complete ? "bg-amber-400/15" : "bg-white/5"}`}>
                  <Users className={`size-4 ${complete ? "text-amber-300" : "text-white/35"}`} />
                </span>
                <div className="flex-1">
                  <p className="text-sm font-semibold">{milestone.need.toLocaleString()} successful referrals</p>
                  <p className="text-[11px] text-white/40">{complete ? "Milestone reached" : "Keep building your referral network"}</p>
                </div>
                <p className={`text-sm font-bold ${complete ? "text-amber-300" : "text-white/55"}`}>
                  +{milestone.points.toLocaleString()} Points
                </p>
              </div>
            );
          })}
        </Card>
      </section>
    </Screen>
  );
}
