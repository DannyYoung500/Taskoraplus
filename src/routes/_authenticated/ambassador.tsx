import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Share2, Crown, ChevronRight, Trophy } from "lucide-react";
import { getDashboard } from "@/lib/taskora.functions";
import { Screen, Card, GoldButton } from "@/components/Screen";
import { TASKORA_LOGO } from "@/lib/brand";

export const Route = createFileRoute("/_authenticated/ambassador")({
  head: () => ({ meta: [{ title: "Referral — TASKORA" }] }),
  loader: async () => {
    const dash = await getDashboard().catch(() => null);
    return { dash };
  },
  component: AmbassadorPage,
});

function AmbassadorPage() {
  const { dash } = Route.useLoaderData();
  const [copied, setCopied] = useState(false);
  const telegramId = dash?.telegramId ?? null;
  const referrals = Number(dash?.referrals ?? 0);

  const link = telegramId
    ? `https://t.me/Taskoraplusbot/?startapp=${encodeURIComponent(String(telegramId))}`
    : "";

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  function share() {
    if (!link) return;
    const text = "Join me on TASKORA — complete tasks and watch videos to earn.";
    window.open(
      `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`,
      "_blank",
    );
  }

  return (
    <Screen>
      <div className="space-y-4 pb-4">
        <div className="flex items-center gap-3">
          <img src={TASKORA_LOGO} alt="" className="size-10 rounded-full ring-1 ring-cyan-400/40" />
          <div>
            <h1 className="text-lg font-black text-white">Referral program</h1>
            <p className="text-[10px] text-slate-500">Task Points · referral commission</p>
          </div>
        </div>

        <Card className="border-cyan-400/25 bg-gradient-to-br from-[#0a1f3d] to-[#061329] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">How it works</p>
          <p className="mt-2 text-sm leading-relaxed text-white/80">
            Share your link. When friends join and complete work, you earn Task Points and a USD commission from their qualifying rewards.
          </p>
          <p className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-[11px] leading-5 text-cyan-100/90">
            Referral unlocks after your invitee completes <span className="font-bold text-cyan-200">3 tasks</span> and{" "}
            <span className="font-bold text-cyan-200">10 watches</span>. Same-device self-referrals are blocked.
          </p>
        </Card>

        <Card className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Your stats</p>
          <p className="mt-3 text-4xl font-black tracking-tight">{referrals}</p>
          <p className="text-xs text-slate-500">successful referrals</p>
          <p className="mt-2 text-[11px] text-slate-400">Task Points are awarded according to the active referral rules.</p>
        </Card>

        <Card className="p-4">
          <p className="text-sm font-black text-white">Your link</p>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-1.5">
            <code className="min-w-0 flex-1 truncate px-2 text-[11px] text-white/70">
              {link || "Open in Telegram to get your link"}
            </code>
            <button
              type="button"
              disabled={!link}
              onClick={() => void copy()}
              className="inline-flex size-10 items-center justify-center rounded-lg bg-white/10 disabled:opacity-40"
            >
              <Copy className="size-4 text-cyan-300" />
            </button>
          </div>
          {copied ? <p className="mt-1 text-[10px] text-emerald-300">Copied</p> : null}
          <GoldButton className="mt-3" disabled={!link} onClick={share}>
            <span className="inline-flex items-center gap-2">
              <Share2 className="size-4" /> Share on Telegram
            </span>
          </GoldButton>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3">
            <Crown className="size-5 text-cyan-300" />
            <p className="mt-2 text-xs font-black text-white">USD commission</p>
            <p className="mt-1 text-[10px] text-slate-500">From unlocked referrals only</p>
          </Card>
          <Card className="p-3">
            <Trophy className="size-5 text-violet-300" />
            <p className="mt-2 text-xs font-black text-white">Task Points</p>
            <p className="mt-1 text-[10px] text-slate-500">Profile & leaderboard</p>
          </Card>
        </div>

        <Link to="/home" className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-300">
          Back to home <ChevronRight className="size-3.5" />
        </Link>
      </div>
    </Screen>
  );
}
