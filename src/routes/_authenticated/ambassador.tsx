import { createFileRoute } from "@tanstack/react-router";
import { Copy, Share2, Users, Crown } from "lucide-react";
import { Screen, ScreenTitle } from "@/components/Screen";
import { USER } from "@/lib/taskora-data";

export const Route = createFileRoute("/ambassador")({
  head: () => ({
    meta: [
      { title: "Channel Ambassador — TASKORA" },
      {
        name: "description",
        content:
          "Invite taskers and channel owners to TASKORA and earn a share of every verified task they complete.",
      },
      { property: "og:title", content: "Channel Ambassador — TASKORA" },
      {
        property: "og:description",
        content: "Earn a lifetime share of every verified task your invites complete.",
      },
    ],
  }),
  component: AmbassadorScreen,
});

const TIERS = [
  { name: "Starter", need: "0 invites", rate: "5%" },
  { name: "Rising", need: "10 invites", rate: "8%" },
  { name: "Ambassador", need: "25 invites", rate: "12%" },
  { name: "Elite", need: "100 invites", rate: "18%" },
];

function AmbassadorScreen() {
  return (
    <Screen>
      <ScreenTitle title="Invite & earn" subtitle="Channel Ambassador programme" />

      <section className="bg-brand rounded-3xl p-5 text-navy-foreground shadow-raised">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-foreground/15 px-2.5 py-1 text-[11px] font-semibold">
          <Crown className="size-3.5" /> Rising ambassador
        </span>
        <p className="mt-3 text-3xl font-bold">{USER.referrals} invites</p>
        <p className="mt-1 text-xs opacity-80">7 more invites to unlock 12% lifetime share</p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-navy-foreground/20">
          <div className="bg-green-grad h-full rounded-full" style={{ width: "72%" }} />
        </div>
      </section>

      <section className="card-surface mt-4 p-4">
        <p className="text-xs text-muted-foreground">Your invite code</p>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 truncate rounded-2xl bg-secondary px-4 py-3 text-sm font-bold tracking-wide">
            {USER.referralCode}
          </code>
          <button
            aria-label="Copy invite code"
            onClick={() => navigator.clipboard?.writeText(USER.referralCode)}
            className="inline-flex size-12 items-center justify-center rounded-2xl bg-secondary"
          >
            <Copy className="size-4" />
          </button>
        </div>
        <button className="bg-green-grad mt-3 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-glow">
          <Share2 className="size-4" /> Share on Telegram
        </button>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-base font-bold">Reward tiers</h2>
        <div className="card-surface divide-y divide-border">
          {TIERS.map((t) => (
            <div key={t.name} className="flex items-center gap-3 p-3.5">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-accent">
                <Users className="size-4 text-accent-foreground" />
              </span>
              <div className="flex-1">
                <p className="text-sm font-semibold">{t.name}</p>
                <p className="text-[11px] text-muted-foreground">{t.need}</p>
              </div>
              <p className="text-sm font-bold text-primary">{t.rate}</p>
            </div>
          ))}
        </div>
      </section>
    </Screen>
  );
}
