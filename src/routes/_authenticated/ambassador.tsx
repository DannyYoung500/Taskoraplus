import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Copy, Share2, Users, Crown } from "lucide-react";
import { Screen, ScreenTitle } from "@/components/Screen";
import { getDashboard, applyReferral } from "@/lib/taskora.functions";

export const Route = createFileRoute("/_authenticated/ambassador")({
  loader: async () => {
    const dash = await getDashboard().catch(() => null);
    return { dash };
  },
  head: () => ({
    meta: [{ title: "Invite — TASKORA" }],
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
  const { dash } = Route.useLoaderData();
  const code = dash?.profile?.referral_code ?? "—";
  const referrals = dash?.referrals ?? 0;
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
      <ScreenTitle title="Invite & earn" subtitle="Referral programme" />

      <section className="bg-brand rounded-3xl p-5 text-navy-foreground shadow-raised">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-navy-foreground/15 px-2.5 py-1 text-[11px] font-semibold">
          <Crown className="size-3.5" /> Ambassador
        </span>
        <p className="mt-3 text-3xl font-bold">{referrals} invites</p>
        <p className="mt-1 text-xs opacity-80">Share of verified rewards on referrals (server ledger)</p>
      </section>

      <section className="card-surface mt-4 p-4">
        <p className="text-xs text-muted-foreground">Your invite code</p>
        <div className="mt-2 flex items-center gap-2">
          <code className="flex-1 truncate rounded-2xl bg-secondary px-4 py-3 text-sm font-bold tracking-wide">
            {code}
          </code>
          <button
            type="button"
            aria-label="Copy invite code"
            onClick={() => navigator.clipboard?.writeText(code)}
            className="inline-flex size-12 items-center justify-center rounded-2xl bg-secondary"
          >
            <Copy className="size-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            const text = `Join TASKORA with my code ${code}`;
            const url = `https://t.me/share/url?url=${encodeURIComponent("https://t.me/Taskoraplusbot")}&text=${encodeURIComponent(text)}`;
            window.open(url, "_blank");
          }}
          className="bg-green-grad mt-3 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold text-primary-foreground shadow-glow"
        >
          <Share2 className="size-4" /> Share on Telegram
        </button>
      </section>

      <section className="card-surface mt-4 space-y-2 p-4">
        <p className="text-sm font-semibold">Have an invite code?</p>
        <input
          value={inviteCode}
          onChange={(e) => setInviteCode(e.target.value)}
          placeholder="TASKORA-XXXXXX"
          className="w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm"
        />
        <button
          type="button"
          onClick={applyCode}
          className="w-full rounded-2xl border border-input py-3 text-sm font-semibold"
        >
          Apply code
        </button>
        {msg ? <p className="text-xs text-muted-foreground">{msg}</p> : null}
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
