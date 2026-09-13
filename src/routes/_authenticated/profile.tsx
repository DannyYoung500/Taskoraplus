import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Globe, LifeBuoy, ShieldCheck, ChevronRight, Link2 } from "lucide-react";
import { Screen, ScreenTitle } from "@/components/Screen";
import { PlatformIcon, type Platform } from "@/components/PlatformIcon";
import { getDashboard } from "@/lib/taskora.functions";
import { listConnectedAccounts } from "@/lib/connected-accounts.functions";

export const Route = createFileRoute("/_authenticated/profile")({
  loader: async () => {
    const [dash, accounts] = await Promise.all([
      getDashboard().catch(() => null),
      listConnectedAccounts().catch(() => []),
    ]);
    return { dash, accounts };
  },
  head: () => ({
    meta: [{ title: "Profile — TASKORA" }],
  }),
  component: ProfileScreen,
});

const PLATFORMS: Platform[] = ["telegram", "youtube", "x", "tiktok", "instagram", "discord"];

function ProfileScreen() {
  const { dash, accounts } = Route.useLoaderData();
  const name = dash?.profile?.display_name ?? "Tasker";
  const handle = dash?.profile?.username ? `@${dash.profile.username}` : "Telegram user";
  const level = dash?.profile?.level ?? "Starter Tasker";
  const verified = dash?.verifiedCount ?? 0;
  const lifetime = Number(dash?.lifetime ?? 0);
  const streak = dash?.profile?.streak ?? 0;
  const isOwner = Boolean(dash?.isOwner);

  const byPlatform = new Map(
    (accounts as Array<{ platform: string; handle: string; status: string }>).map((a) => [
      a.platform,
      a,
    ]),
  );

  return (
    <Screen>
      <ScreenTitle title="Profile" />

      <section className="card-surface flex items-center gap-3 p-4">
        <span className="bg-green-grad inline-flex size-14 items-center justify-center rounded-2xl text-xl font-bold text-primary-foreground">
          {name.charAt(0)}
        </span>
        <div>
          <p className="text-base font-bold leading-tight">{name}</p>
          <p className="text-xs text-muted-foreground">{handle}</p>
          <span className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
            <ShieldCheck className="size-3" /> {level}
          </span>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-3 gap-2.5 text-center">
        <Stat value={`${verified}`} label="Verified" />
        <Stat value={`$${lifetime.toFixed(0)}`} label="Lifetime" />
        <Stat value={`${streak}d`} label="Streak" />
      </section>

      {isOwner ? (
        <Link to="/owner" className="card-surface mt-4 block p-4 text-sm font-semibold text-primary">
          Owner Control Center →
        </Link>
      ) : null}

      <section className="mt-6">
        <h2 className="mb-3 text-base font-bold">Connected accounts</h2>
        <div className="card-surface divide-y divide-border">
          {PLATFORMS.map((platform) => {
            const row = byPlatform.get(platform);
            return (
              <Link
                key={platform}
                to="/connected"
                className="flex items-center gap-3 p-3.5"
              >
                <PlatformIcon platform={platform} size={22} />
                <p className="flex-1 text-sm font-medium">
                  {row?.handle ?? "Not connected"}
                </p>
                {row?.status === "verified" ? (
                  <span className="text-[11px] font-semibold text-success">Verified</span>
                ) : row ? (
                  <span className="text-[11px] font-semibold text-warning">{row.status}</span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">
                    <Link2 className="size-3" /> Connect
                  </span>
                )}
              </Link>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Accounts stay pending until real platform verification is configured. No fake auto-verify.
        </p>
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-base font-bold">Settings</h2>
        <div className="card-surface divide-y divide-border">
          {[
            { label: "Language", value: "English", Icon: Globe },
            { label: "Notifications", value: "On", Icon: Bell },
            { label: "Security", value: "Telegram verified", Icon: ShieldCheck },
            { label: "Support", value: "", Icon: LifeBuoy },
          ].map(({ label, value, Icon }) => (
            <button key={label} type="button" className="flex w-full items-center gap-3 p-3.5 text-left">
              <Icon className="size-4 text-primary" />
              <span className="flex-1 text-sm font-medium">{label}</span>
              <span className="text-xs text-muted-foreground">{value}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          ))}
        </div>
      </section>
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="card-surface p-3">
      <p className="text-sm font-bold leading-none">{value}</p>
      <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
