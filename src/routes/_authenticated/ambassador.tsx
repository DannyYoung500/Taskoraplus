import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Share2, Users, Trophy, DollarSign, Check, ArrowUpRight } from "lucide-react";
import { Screen, ScreenTitle, Card, GoldButton } from "@/components/Screen";
import { getDashboard } from "@/lib/taskora.functions";

export const Route = createFileRoute("/_authenticated/ambassador")({
  loader: async () => {
    const dash = await getDashboard().catch(() => null);
    return { dash };
  },
  head: () => ({ meta: [{ title: "Referral — TASKORA" }] }),
  component: ReferralScreen,
});

const MILESTONES = [
  { need: 5, points: 250, name: "Starter" },
  { need: 10, points: 500, name: "Builder" },
  { need: 25, points: 1000, name: "Connector" },
  { need: 50, points: 2000, name: "Pro" },
  { need: 100, points: 4000, name: "Elite" },
  { need: 250, points: 7500, name: "Champion" },
  { need: 500, points: 12500, name: "Titan" },
  { need: 1000, points: 20000, name: "Legend" },
  { need: 2500, points: 35000, name: "Master" },
  { need: 5000, points: 60000, name: "Vanguard" },
  { need: 10000, points: 100000, name: "Icon" },
  { need: 25000, points: 175000, name: "Apex" },
  { need: 50000, points: 300000, name: "Grandmaster" },
  { need: 100000, points: 500000, name: "Hall of Fame" },
];

const TELEGRAM_BOT_USERNAME = "Taskoraplusbot";
const REFERRAL_IMAGE =
  "https://images.unsplash.com/photo-1758525226768-2d1b900ba2c0?auto=format&fit=crop&fm=jpg&q=80&w=1400";

function ReferralScreen() {
  const { dash } = Route.useLoaderData();
  const telegramId = dash?.telegramId ?? null;
  const referrals = dash?.referrals ?? 0;
  const referralLink = telegramId
    ? `https://t.me/${TELEGRAM_BOT_USERNAME}/?startapp=${encodeURIComponent(String(telegramId))}`
    : "";
  const [copied, setCopied] = useState(false);

  const nextIndex = MILESTONES.findIndex((milestone) => referrals < milestone.need);
  const nextMilestone = nextIndex >= 0 ? MILESTONES[nextIndex] : null;
  const previousNeed = nextIndex > 0 ? MILESTONES[nextIndex - 1].need : 0;
  const progress = nextMilestone
    ? Math.min(100, Math.max(0, ((referrals - previousNeed) / (nextMilestone.need - previousNeed)) * 100))
    : 100;

  async function copyReferralLink() {
    if (!referralLink) return;
    try {
      await navigator.clipboard?.writeText(referralLink);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <Screen>
      <ScreenTitle title="Referral" subtitle="Build your network and earn real USD commission." />

      <section className="relative overflow-hidden rounded-[28px] border border-amber-300/25 bg-[#0b0d12] shadow-[0_18px_60px_rgba(0,0,0,0.35)]">
        <img
          src={REFERRAL_IMAGE}
          alt="Friends sharing something on a smartphone"
          className="absolute inset-0 h-full w-full object-cover opacity-35"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#07080c]/95 via-[#090b10]/80 to-[#090b10]/35" />
        <div className="relative p-5 sm:p-6">
          <div className="flex items-center gap-2 text-amber-300">
            <span className="inline-flex size-9 items-center justify-center rounded-2xl border border-amber-300/25 bg-amber-300/10">
              <Users className="size-4" />
            </span>
            <span className="text-[11px] font-bold uppercase tracking-[0.18em]">TASKORA Referral</span>
          </div>
          <h2 className="mt-4 max-w-[300px] text-2xl font-black leading-tight text-white">
            Grow your network.
            <span className="block text-amber-300">Earn 10% in USD.</span>
          </h2>
          <p className="mt-2 max-w-[330px] text-xs leading-5 text-white/60">
            Earn a 10% USD commission from every qualifying task reward completed by your successful referrals.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-black/25 px-3 py-1.5 text-[11px] font-semibold text-white/80">
              10% USD commission
            </span>
            <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1.5 text-[11px] font-semibold text-amber-200">
              + Task Points milestones
            </span>
          </div>
        </div>
      </section>

      <p className="mt-2 px-1 text-[9px] text-white/25">
        Photo by Vitaly Gariev on Unsplash · <a href="https://unsplash.com/@gariev" target="_blank" rel="noreferrer" className="underline">view photographer</a>
      </p>

      <Card className="mt-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-white/45">Successful referrals</p>
            <p className="mt-1 text-2xl font-black text-white">{referrals.toLocaleString()}</p>
          </div>
          <div className="inline-flex size-12 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10">
            <DollarSign className="size-5 text-emerald-300" />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-[11px]">
          <span className="text-white/40">Referral commission</span>
          <span className="font-bold text-emerald-300">10% USD</span>
        </div>
      </Card>

      <Card className="mt-4 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-white/45">Your referral link</p>
            <p className="mt-1 text-xs text-white/35">Share your personal TASKORA link.</p>
          </div>
          <Share2 className="size-4 text-amber-300" />
        </div>
        <div className="mt-3 flex items-center gap-2">
          <code className="flex-1 truncate rounded-2xl border border-white/10 bg-black/25 px-4 py-3 text-sm font-bold tracking-wide">
            {referralLink || "Telegram session required"}
          </code>
          <button
            type="button"
            aria-label="Copy referral link"
            disabled={!referralLink}
            onClick={() => void copyReferralLink()}
            className="inline-flex size-12 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/5 disabled:opacity-40"
          >
            {copied ? <Check className="size-4 text-emerald-300" /> : <Copy className="size-4 text-amber-300" />}
          </button>
        </div>
        <GoldButton
          className="mt-3"
          disabled={!referralLink}
          onClick={() => {
            if (!referralLink) return;
            const text = "Join me on TASKORA and start earning rewards.";
            const url = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(text)}`;
            window.open(url, "_blank");
          }}
        >
          <span className="inline-flex items-center justify-center gap-2">
            <Share2 className="size-4" /> Share on Telegram
          </span>
        </GoldButton>
      </Card>

      <section className="mt-6">
        <div className="mb-3 flex items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-bold">Referral milestones</h2>
            <p className="mt-1 text-[11px] text-white/40">Reach each level to unlock Task Points.</p>
          </div>
          {nextMilestone ? (
            <p className="shrink-0 text-right text-[11px] text-amber-300">{nextMilestone.need - referrals} to go</p>
          ) : (
            <p className="shrink-0 text-right text-[11px] text-amber-300">All levels complete</p>
          )}
        </div>

        {nextMilestone ? (
          <Card className="mb-3 overflow-hidden p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold">Next level: {nextMilestone.name}</p>
                <p className="mt-1 text-xs text-white/40">
                  {nextMilestone.need.toLocaleString()} successful referrals · +{nextMilestone.points.toLocaleString()} Task Points
                </p>
              </div>
              <Trophy className="size-5 text-amber-300" />
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/8">
              <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-200 transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-[10px] text-white/30">{referrals.toLocaleString()} / {nextMilestone.need.toLocaleString()} successful referrals</p>
          </Card>
        ) : null}

        <Card className="divide-y divide-white/8">
          {MILESTONES.map((milestone) => {
            const complete = referrals >= milestone.need;
            return (
              <div key={milestone.need} className="flex items-center gap-3 p-3.5">
                <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-2xl ${complete ? "bg-amber-400/15" : "bg-white/5"}`}>
                  {complete ? <Check className="size-4 text-amber-300" /> : <Trophy className="size-4 text-white/30" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-bold">{milestone.name}</p>
                    {complete ? <span className="text-[9px] font-bold uppercase tracking-wider text-amber-300">Unlocked</span> : null}
                  </div>
                  <p className="mt-0.5 text-[11px] text-white/40">{milestone.need.toLocaleString()} successful referrals</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-sm font-black ${complete ? "text-amber-300" : "text-white/55"}`}>+{milestone.points.toLocaleString()}</p>
                  <p className="text-[9px] text-white/30">Task Points</p>
                </div>
                {!complete ? <ArrowUpRight className="size-3.5 text-white/20" /> : null}
              </div>
            );
          })}
        </Card>
      </section>
    </Screen>
  );
}
