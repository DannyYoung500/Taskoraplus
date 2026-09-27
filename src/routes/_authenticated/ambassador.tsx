import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Copy, Share2, Crown, ChevronRight, Trophy, LockKeyhole, CheckCircle2 } from "lucide-react";
import { getDashboard } from "@/lib/taskora.functions";
import { Screen, Card, GoldButton } from "@/components/Screen";
import { TASKORA_LOGO } from "@/lib/brand";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const getReferralChallenge = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: cfgRow } = await supabaseAdmin.from("app_settings").select("value").eq("key", "referral_challenge").maybeSingle();
    const cfg = (cfgRow?.value ?? {}) as Record<string, unknown>;
    const target = {
      tasks: Number(cfg.task_target ?? 5),
      videos: Number(cfg.video_target ?? 20),
      games: Number(cfg.game_target ?? 5),
      ads: Number(cfg.ad_target ?? 20),
    };
    const bonus = {
      join: Number(cfg.join_bonus_usd ?? 0.0012),
      tasks: Number(cfg.task_bonus_usd ?? 0.004),
      videos: Number(cfg.video_bonus_usd ?? 0.006),
      games: Number(cfg.game_bonus_usd ?? 0.005),
      ads: Number(cfg.ad_bonus_usd ?? 0.0072),
    };
    const commissionPercent = Number(cfg.withdrawal_commission_percent ?? 10);

    const { data: rows } = await supabaseAdmin
      .from("profiles")
      .select("id,display_name,username,created_at")
      .eq("referred_by", context.userId);

    const members = await Promise.all((rows ?? []).map(async (friend) => {
      const [tasks, videos, games, ads, gate] = await Promise.all([
        supabaseAdmin.from("submissions").select("id", { count: "exact", head: true }).eq("user_id", friend.id).eq("status", "verified"),
        supabaseAdmin.from("watch_video_sessions").select("id", { count: "exact", head: true }).eq("user_id", friend.id).eq("status", "completed"),
        supabaseAdmin.from("game_rounds").select("id", { count: "exact", head: true }).eq("user_id", friend.id).eq("status", "completed"),
        supabaseAdmin.from("watch_completions").select("id", { count: "exact", head: true }).eq("user_id", friend.id),
        supabaseAdmin.from("telegram_gate_events").select("id,status,membership_status").eq("user_id", friend.id)
          .in("status", ["verified", "success", "passed"])
          .in("membership_status", ["member", "administrator", "creator", "owner", "joined", "success"])
          .order("checked_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      const progress = {
        join: Boolean(gate.data),
        tasks: Math.min(tasks.count ?? 0, target.tasks),
        videos: Math.min(videos.count ?? 0, target.videos),
        games: Math.min(games.count ?? 0, target.games),
        ads: Math.min(ads.count ?? 0, target.ads),
      };
      const valid = progress.join && progress.tasks >= target.tasks && progress.videos >= target.videos &&
        progress.games >= target.games && progress.ads >= target.ads;
      const ratios = [
        progress.join ? 1 : 0,
        progress.tasks / Math.max(1, target.tasks),
        progress.videos / Math.max(1, target.videos),
        progress.games / Math.max(1, target.games),
        progress.ads / Math.max(1, target.ads),
      ];
      const pct = Math.round(Math.min(...ratios) * 100);
      return { id: friend.id, name: friend.display_name || friend.username || "Friend", progress, valid, pct };
    }));

    const validCount = members.filter((m) => m.valid).length;
    const earnings = await supabaseAdmin.from("transactions").select("amount").eq("user_id", context.userId).eq("kind", "referral");
    const referralEarnings = (earnings.data ?? []).reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const totalMilestones = bonus.join + bonus.tasks + bonus.videos + bonus.games + bonus.ads;
    return { target, bonus, commissionPercent, members, validCount, referralEarnings, totalMilestones };
  });

export const Route = createFileRoute("/_authenticated/ambassador")({
  head: () => ({ meta: [{ title: "Referral — TASKORA" }] }),
  loader: async () => {
    const [dash, challenge] = await Promise.all([getDashboard().catch(() => null), getReferralChallenge().catch(() => null)]);
    return { dash, challenge };
  },
  component: AmbassadorPage,
});

function AmbassadorPage() {
  const { dash, challenge } = Route.useLoaderData();
  const [copied, setCopied] = useState(false);
  const telegramId = dash?.telegramId ?? null;
  const referrals = Number(challenge?.validCount ?? dash?.referrals ?? 0);
  const link = telegramId ? `https://t.me/Taskoraplusbot/?startapp=${encodeURIComponent(String(telegramId))}` : "";

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  function share() {
    if (!link) return;
    const text = "Join me on TASKORA — complete tasks and earn USDT.";
    window.open(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`, "_blank");
  }

  const rewards = challenge?.bonus ?? { join: 0.0012, tasks: 0.004, videos: 0.006, games: 0.005, ads: 0.0072 };
  const total = challenge?.totalMilestones ?? 0.0234;

  return (
    <Screen>
      <div className="space-y-4 pb-4">
        <div className="flex items-center gap-3">
          <img src={TASKORA_LOGO} alt="" className="size-10 rounded-full ring-1 ring-cyan-400/40" />
          <div>
            <h1 className="text-lg font-black text-white">Referral program</h1>
            <p className="text-[10px] text-slate-500">Referral Challenge · earn from valid referrals</p>
          </div>
        </div>

        <Card className="border-cyan-400/25 bg-gradient-to-br from-[#0a1f3d] to-[#061329] p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">Referral Challenge</p>
          <p className="mt-2 text-sm leading-relaxed text-white/80">Invite friends and help them complete all five requirements.</p>
          <p className="mt-3 rounded-xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-2 text-[11px] leading-5 text-cyan-100/90">
            A referral becomes <b>VALID</b> only when every requirement below is completed.
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Referral Requirements</p>
            <span className="text-[10px] font-bold text-cyan-200">5 required</span>
          </div>
          <div className="mt-3 space-y-2">
            {[
              ["🤝", "Join + Verify", "Community membership verified"],
              ["✅", "5 Tasks", "Complete 5 verified tasks"],
              ["🎬", "20 Videos", "Complete 20 eligible video watches"],
              ["🎮", "5 Games", "Complete 5 eligible games"],
              ["📺", "20 Ads", "Complete 20 rewarded ads"],
            ].map(([icon, title, detail]) => (
              <div key={title} className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-3">
                <span className="text-base">{icon}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white">{title}</p>
                  <p className="text-[10px] text-slate-500">{detail}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">USD Referral Rewards</p>
            <p className="text-xs font-bold text-emerald-300">Total $0.0234</p>
          </div>
          <div className="mt-3 space-y-2">
            {[
              ["🤝", "Join + Verify", rewards.join],
              ["✅", "5 Tasks", rewards.tasks],
              ["🎬", "20 Videos", rewards.videos],
              ["🎮", "5 Games", rewards.games],
              ["📺", "20 Ads", rewards.ads],
            ].map(([icon, label, amount]) => (
              <div key={label} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.025] px-3 py-3">
                <div className="flex items-center gap-2">
                  <span>{icon}</span>
                  <span className="text-xs font-semibold text-white">{label}</span>
                </div>
                <span className="text-xs font-bold text-emerald-300">+$${Number(amount).toFixed(4)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-slate-500">USD rewards are paid once per referral milestone. No points or lootboxes.</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">After Referral Becomes Valid</p>
            <span className="text-sm font-black text-cyan-200">{challenge?.commissionPercent ?? 10}%</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-white">Withdrawal commission</p>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">Earn {challenge?.commissionPercent ?? 10}% whenever your valid referral makes a qualifying withdrawal.</p>
        </Card>

        {(challenge?.members?.length ?? 0) > 0 ? (
          <Card className="p-4">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Your Referrals</p>
            <div className="mt-3 space-y-2">
              {challenge!.members.map((friend) => (
                <div key={friend.id} className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold text-white">{friend.name}</p>
                    {friend.valid ? <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-300"><CheckCircle2 className="size-3" /> VALID</span> : <LockKeyhole className="size-3.5 text-slate-500" />}
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full rounded-full bg-cyan-400" style={{ width: `${friend.pct}%` }} />
                  </div>
                  <p className="mt-1.5 text-[9px] text-slate-500">
                    {friend.pct}% · {friend.progress.join ? "Join ✓" : "Join"} · {friend.progress.tasks}/{challenge!.target.tasks} tasks · {friend.progress.videos}/{challenge!.target.videos} videos · {friend.progress.games}/{challenge!.target.games} games · {friend.progress.ads}/{challenge!.target.ads} ads
                  </p>
                </div>
              ))}
            </div>
          </Card>
        ) : null}

        <Card className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Your Stats</p>
          <p className="mt-3 text-4xl font-black tracking-tight">{referrals}</p>
          <p className="text-xs text-slate-500">valid referrals</p>
          <p className="mt-2 text-[11px] text-slate-400">Referral earnings: $${challenge?.referralEarnings.toFixed(4) ?? "0.0000"}</p>
          <p className="mt-1 text-[10px] text-slate-500">Full referral milestone total: $${total.toFixed(4)}</p>
        </Card>

        <Card className="p-4">
          <p className="text-sm font-black text-white">Your link</p>
          <div className="mt-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 p-1.5">
            <code className="min-w-0 flex-1 truncate px-2 text-[11px] text-white/70">{link || "Open in Telegram to get your link"}</code>
            <button type="button" disabled={!link} onClick={() => void copy()} className="inline-flex size-10 items-center justify-center rounded-lg bg-white/10 disabled:opacity-40"><Copy className="size-4 text-cyan-300" /></button>
          </div>
          {copied ? <p className="mt-1 text-[10px] text-emerald-300">Copied</p> : null}
          <GoldButton className="mt-3" disabled={!link} onClick={share}><span className="inline-flex items-center gap-2"><Share2 className="size-4" /> Share on Telegram</span></GoldButton>
        </Card>

        <div className="grid grid-cols-2 gap-3">
          <Card className="p-3">
            <Crown className="size-5 text-cyan-300" />
            <p className="mt-2 text-xs font-black text-white">10% commission</p>
            <p className="mt-1 text-[10px] text-slate-500">After the referral becomes valid</p>
          </Card>
          <Card className="p-3">
            <Trophy className="size-5 text-violet-300" />
            <p className="mt-2 text-xs font-black text-white">$0.0234 total</p>
            <p className="mt-1 text-[10px] text-slate-500">Five USD milestones</p>
          </Card>
        </div>

        <Link to="/home" className="inline-flex items-center gap-1 text-[11px] font-bold text-cyan-300">Back to home <ChevronRight className="size-3.5" /></Link>
      </div>
    </Screen>
  );
}
