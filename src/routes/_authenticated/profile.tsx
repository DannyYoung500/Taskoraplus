import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Globe, LifeBuoy, ShieldCheck, ChevronRight, Link2, Crown } from "lucide-react";
import { Screen, ScreenTitle } from "@/components/Screen";
import { PlatformIcon } from "@/components/PlatformIcon";
import { getDashboard } from "@/lib/taskora.functions";
import { listConnectedAccounts } from "@/lib/connected-accounts.functions";
import { CONNECTABLE_PLATFORMS } from "@/lib/taskora-data";

export const Route = createFileRoute("/_authenticated/profile")({
  loader: async () => {
    const [dash, accounts] = await Promise.all([
      getDashboard().catch(() => null),
      listConnectedAccounts().catch(() => []),
    ]);
    return { dash, accounts };
  },
  component: ProfileScreen,
});

function ProfileScreen() {
  const { dash, accounts } = Route.useLoaderData();
  const profile = dash?.profile as
    | {
        display_name?: string | null;
        username?: string | null;
        level?: string | null;
        streak?: number | null;
        photo_url?: string | null;
      }
    | null
    | undefined;

  const name = profile?.display_name ?? "Tasker";
  const handle = profile?.username ? `@${profile.username}` : "Telegram user";
  const level = profile?.level ?? "Starter Tasker";
  const photo = profile?.photo_url ?? null;
  const verified = dash?.verifiedCount ?? 0;
  const lifetime = Number(dash?.lifetime ?? 0);
  const streak = profile?.streak ?? 0;
  const isOwner = Boolean(dash?.isOwner);

  const byPlatform = new Map(
    (accounts as Array<{ platform: string; handle: string; status: string }>).map((a) => [a.platform, a]),
  );

  return (
    <Screen>
      <ScreenTitle title="Profile" subtitle="Your TASKORA identity" />

      <section className="card-surface flex items-center gap-3 p-4">
        {photo ? (
          <img src={photo} alt="" className="size-14 rounded-2xl object-cover ring-2 ring-primary/30" />
        ) : (
          <span className="bg-green-grad inline-flex size-14 items-center justify-center rounded-2xl text-xl font-bold text-primary-foreground">
            {name.charAt(0)}
          </span>
        )}
        <div className="min-w-0">
          <p className="truncate text-base font-bold">{name}</p>
          <p className="text-xs text-muted-foreground">{handle}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-accent-foreground">
              <ShieldCheck className="size-3" /> {level}
            </span>
            {isOwner ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                <Crown className="size-3" /> Owner
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-4 grid grid-cols-3 gap-2.5 text-center">
        <Stat value={`${verified}`} label="Verified" />
        <Stat value={`$${lifetime.toFixed(0)}`} label="Lifetime" />
        <Stat value={`${streak}d`} label="Streak" />
      </section>

      {isOwner ? (
        <Link to="/owner" className="mt-4 block rounded-2xl border border-primary/40 bg-primary/10 p-4 text-sm font-bold text-primary">
          Owner Control Center →
        </Link>
      ) : null}

      <Link to="/support" className="card-surface mt-3 block p-4 text-sm font-semibold">
        Support tickets →
      </Link>

      <section className="mt-6">
        <h2 className="mb-3 text-base font-bold">Connected accounts</h2>
        <div className="card-surface divide-y divide-border">
          {CONNECTABLE_PLATFORMS.map((platform) => {
            const row = byPlatform.get(platform);
            return (
              <Link key={platform} to="/connected" className="flex items-center gap-3 p-3.5">
                <PlatformIcon platform={platform} size={22} />
                <p className="flex-1 text-sm font-medium capitalize">{row?.handle ?? platform}</p>
                {row ? (
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
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-base font-bold">Settings</h2>
        <div className="card-surface divide-y divide-border">
          {[
            { label: "Language", value: "English", Icon: Globe },
            { label: "Notifications", value: "On", Icon: Bell },
            { label: "Security", value: "Telegram verified", Icon: ShieldCheck },
            { label: "Support", value: "Open", Icon: LifeBuoy },
          ].map(({ label, value, Icon }) => (
            <Link
              key={label}
              to={label === "Support" ? "/support" : "/profile"}
              className="flex w-full items-center gap-3 p-3.5 text-left"
            >
              <Icon className="size-4 text-primary" />
              <span className="flex-1 text-sm font-medium">{label}</span>
              <span className="text-xs text-muted-foreground">{value}</span>
              <ChevronRight className="size-4 text-muted-foreground" />
            </Link>
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
