import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  Clipboard,
  Copy,
  Link2,
  Share2,
  ShieldCheck,
  Sparkles,
  Trophy,
  Users,
  WalletCards,
  Zap,
} from "lucide-react";
import { Screen, Card, GoldButton } from "@/components/Screen";
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
  "https://images.unsplash.com/photo-1758525226768-2d1b900ba2c0?auto=format&fit=crop&fm=jpg&q=90&w=1800";
const MILESTONE_IMAGE =
  "https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&fm=jpg&q=90&w=1600";

function ReferralScreen() {
  const { dash } = Route.useLoaderData();
  const telegramId = dash?.telegramId ?? null;
  const referrals = dash?.referrals ?? 0;
  const taskPoints = Number((dash?.profile as { task_points?: number | null } | null)?.task_points ?? 0);
  const referralLink = telegramId
    ? `https://t.me/${TELEGRAM_BOT_USERNAME}/?startapp=${encodeURIComponent(String(telegramId))}`
    : "";
  const [copied, setCopied] = useState(false);

  const nextIndex = MILESTONES.findIndex((milestone) => referrals < milestone.need);
  const nextMilestone = nextIndex >= 0 ? MILESTONES[nextIndex] : null;
  const previousNeed = nextIndex > 0 ? MILESTONES[nextIndex - 1].need : 0;
  const progress = nextMilestone
    ? Math.min(
        100,
        Math.max(
          0,
          ((referrals - previousNeed) / (nextMilestone.need - previousNeed)) * 100,
        ),
      )
    : 100;

  const currentMilestone = nextMilestone
    ? nextIndex > 0
      ? MILESTONES[nextIndex - 1]
      : null
    : MILESTONES[MILESTONES.length - 1];

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

  function shareOnTelegram() {
    if (!referralLink) return;
    const text = "Join me on TASKORA and start completing tasks for rewards.";
    const url = `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  }

  return (
    <Screen>
      <div className="space-y-4 pb-2">
        <section className="relative isolate overflow-hidden rounded-[30px] border border-cyan-400/30 bg-[#061329] shadow-[0_20px_70px_rgba(0,104,255,0.2)]">
          <img
            src={REFERRAL_IMAGE}
            alt="Friends sharing something on a smartphone"
            className="absolute inset-0 z-0 h-full w-full object-cover object-center opacity-60"
            loading="eager"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 z-0 bg-[linear-gradient(90deg,rgba(2,8,23,0.96)_0%,rgba(2,8,23,0.86)_38%,rgba(2,8,23,0.35)_100%)]" />
          <div className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_78%_38%,rgba(0,194,255,0.4),transparent_34%)]" />
          <div className="relative z-10 p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <span className="inline-flex size-9 items-center justify-center rounded-xl border border-cyan-300/30 bg-cyan-400/10 shadow-[0_0_22px_rgba(0,195,255,0.18)]">
                <Zap className="size-4 text-cyan-300" />
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">TASKORA</p>
                <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/50">Referral</p>
              </div>
            </div>

            <h1 className="mt-5 max-w-[310px] text-[30px] font-black leading-[0.98] tracking-[-0.04em] text-white">
              Refer friends.
              <span className="block bg-gradient-to-r from-cyan-300 via-sky-400 to-blue-500 bg-clip-text text-transparent">
                Earn Task Points + 10% USD commission.
              </span>
            </h1>
            <p className="mt-3 max-w-[340px] text-xs leading-5 text-white/75">
              Earn Task Points for successful referrals, plus a 10% USD commission from qualifying task rewards your referrals complete.
            </p>

            <div className="mt-5 grid grid-cols-3 gap-2">
              {[
                { icon: Users, label: "Invite", value: "Friends" },
                { icon: Clipboard, label: "They", value: "Complete" },
                { icon: WalletCards, label: "You get", value: "10% USD" },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-2xl border border-white/15 bg-black/35 px-2 py-3 text-center backdrop-blur-md">
                  <Icon className="mx-auto size-4 text-cyan-300" />
                  <p className="mt-2 text-[9px] font-semibold uppercase tracking-wide text-white/45">{label}</p>
                  <p className="mt-0.5 text-[10px] font-bold text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[24px] border border-cyan-400/20 bg-[#07172f]/90 p-4 shadow-[0_12px_45px_rgba(0,98,255,0.08)]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-cyan-300">Your progress</p>
              <p className="mt-1 text-xl font-black text-white">
                {referrals.toLocaleString()} <span className="text-xs font-semibold text-white/45">successful referrals</span><span className="ml-3 text-sm font-black text-violet-300">{taskPoints.toLocaleString()} <span className="text-[10px] font-semibold text-white/35">Task Points</span></span>
              </p>
            </div>
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10">
              <Users className="size-5 text-cyan-300" />
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between text-[10px]">
            <span className="text-white/35">
              {currentMilestone ? `${currentMilestone.name} reached` : "Starter level"}
            </span>
            <span className="font-bold text-cyan-300">
              {nextMilestone ? `${nextMilestone.need - referrals} to ${nextMilestone.name}` : "All levels complete"}
            </span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-600 via-cyan-400 to-white shadow-[0_0_18px_rgba(34,211,238,0.55)] transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </section>

        <Card className="overflow-hidden border-cyan-400/20 bg-gradient-to-br from-[#082341] to-[#061329] p-0">
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-400/10">
                <Link2 className="size-5 text-cyan-300" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-white">Your Referral Link</p>
                <p className="mt-0.5 text-[10px] text-white/40">Share your personal TASKORA link.</p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/25 p-1.5">
              <code className="min-w-0 flex-1 truncate px-2 text-[11px] font-semibold text-white/70">
                {referralLink || "Telegram session required"}
              </code>
              <button
                type="button"
                aria-label="Copy referral link"
                disabled={!referralLink}
                onClick={() => void copyReferralLink()}
                className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/7 transition hover:bg-white/10 disabled:opacity-40"
              >
                {copied ? <Check className="size-4 text-emerald-300" /> : <Copy className="size-4 text-cyan-300" />}
              </button>
            </div>

            <GoldButton className="mt-3" disabled={!referralLink} onClick={shareOnTelegram}>
              <span className="inline-flex w-full items-center justify-center gap-2">
                <Share2 className="size-4" /> Share on Telegram <ArrowRight className="size-4" />
              </span>
            </GoldButton>
          </div>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          <section className="rounded-[24px] border border-emerald-400/25 bg-gradient-to-br from-[#062a2a] to-[#07172a] p-4 shadow-[0_12px_45px_rgba(16,185,129,0.08)]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex size-10 items-center justify-center rounded-xl border border-emerald-300/20 bg-emerald-400/10">
                <WalletCards className="size-5 text-emerald-300" />
              </div>
              <span className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-300">USD</span>
            </div>
            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300/75">Referral Commission</p>
            <p className="mt-1 text-xl font-black text-white">Earn 10% in USD</p>
            <p className="mt-2 text-[11px] leading-5 text-white/45">Receive 10% of every qualifying task reward your referral completes.</p>
            <div className="mt-3 flex items-center gap-2 border-t border-white/8 pt-3 text-[10px] text-emerald-200/70">
              <ShieldCheck className="size-3.5 shrink-0" /> Withdrawable according to TASKORA rules.
            </div>
          </section>

          <section className="rounded-[24px] border border-violet-400/25 bg-gradient-to-br from-[#17104a] to-[#0b1633] p-4 shadow-[0_12px_45px_rgba(139,92,246,0.08)]">
            <div className="flex items-center justify-between gap-2">
              <div className="flex size-10 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-400/10">
                <Sparkles className="size-5 text-violet-300" />
              </div>
              <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-2.5 py-1 text-[9px] font-black uppercase tracking-wider text-violet-300">Profile</span>
            </div>
            <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300/75">Task Points</p>
            <p className="mt-1 text-xl font-black text-white">Earn Task Points</p>
            <p className="mt-2 text-[11px] leading-5 text-white/45">Every successful referral earns Task Points; milestones add additional Task Points for your profile and leaderboard.</p>
            <div className="mt-3 flex items-center gap-2 border-t border-white/8 pt-3 text-[10px] text-violet-200/70">
              <Sparkles className="size-3.5 shrink-0" /> Task Points are not withdrawable.
            </div>
          </section>
        </div>

        <section className="relative isolate overflow-hidden rounded-[26px] border border-cyan-400/20 bg-[#061329] shadow-[0_16px_55px_rgba(0,83,255,0.08)]">
          <div className="relative h-32 overflow-hidden sm:h-40">
            <img
              src={MILESTONE_IMAGE}
              alt="Friends celebrating together"
              className="absolute inset-0 h-full w-full object-cover opacity-55"
              loading="lazy"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#061329]/25 via-[#061329]/60 to-[#061329]" />
            <div className="absolute inset-x-4 bottom-4 flex items-end justify-between gap-3 sm:inset-x-5">
              <div className="flex items-center gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/25 bg-[#061329]/80 backdrop-blur-md">
                  <Trophy className="size-5 text-cyan-300" />
                </div>
                <div>
                  <h2 className="text-base font-black text-white">Referral Milestones</h2>
                  <p className="mt-1 text-[10px] leading-4 text-white/55">Reach each milestone to unlock Task Points.</p>
                </div>
              </div>
              <span className="hidden shrink-0 rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-cyan-300 sm:inline-flex">
                Task Points
              </span>
            </div>
          </div>

          <div className="p-4">
            {nextMilestone ? (
              <div className="rounded-2xl border border-white/8 bg-white/3 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-white/35">Next milestone</p>
                    <p className="mt-1 text-sm font-black text-white">{nextMilestone.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-cyan-300">+{nextMilestone.points.toLocaleString()}</p>
                    <p className="text-[9px] text-white/30">Task Points</p>
                  </div>
                </div>
                <p className="mt-2 text-[10px] text-white/35">
                  {nextMilestone.need.toLocaleString()} successful referrals · {nextMilestone.need - referrals} remaining
                </p>
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {MILESTONES.map((milestone) => {
                const complete = referrals >= milestone.need;
                const isNext = nextMilestone?.need === milestone.need;
                return (
                  <div
                    key={milestone.need}
                    className={`relative overflow-hidden rounded-2xl border p-3 text-center transition ${
                      isNext
                        ? "border-cyan-300/60 bg-cyan-300/8 shadow-[0_0_24px_rgba(34,211,238,0.1)]"
                        : complete
                          ? "border-emerald-300/20 bg-emerald-300/5"
                          : "border-white/8 bg-white/2"
                    }`}
                  >
                    {complete ? (
                      <span className="absolute right-2 top-2 inline-flex size-4 items-center justify-center rounded-full bg-emerald-400/15">
                        <Check className="size-2.5 text-emerald-300" />
                      </span>
                    ) : null}
                    <div className={`mx-auto flex size-10 items-center justify-center rounded-full border ${complete ? "border-emerald-300/30 bg-emerald-300/10" : "border-cyan-300/15 bg-cyan-300/5"}`}>
                      <Trophy className={`size-4 ${complete ? "text-emerald-300" : "text-cyan-300/70"}`} />
                    </div>
                    <p className="mt-2 truncate text-[10px] font-black text-white">{milestone.name}</p>
                    <p className="mt-0.5 text-[11px] font-black text-cyan-300">{milestone.need.toLocaleString()}</p>
                    <p className="mt-1 text-[8px] text-white/30">+{milestone.points.toLocaleString()} TP</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </div>
    </Screen>
  );
}
