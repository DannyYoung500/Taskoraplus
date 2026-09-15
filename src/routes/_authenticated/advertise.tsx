import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft, Clock, CheckCircle2, Sparkles } from "lucide-react";
import {
  PLATFORM_META,
  PLATFORM_ORDER,
  CATEGORY_LABELS,
  PlatformLogo,
  type Platform,
} from "@/components/PlatformIcon";
import { ownerCreateTask } from "@/lib/taskora.functions";

export const Route = createFileRoute("/_authenticated/advertise")({
  head: () => ({ meta: [{ title: "Advertise — TASKORA" }] }),
  component: AdvertisePage,
});

type ServiceDef = {
  id: string;
  taskType: string;
  title: string;
  desc: string;
  fromUsd: number;
  rangeLabel: string;
  delivery: string;
};

const SERVICES: Record<Platform, ServiceDef[]> = {
  instagram: [
    { id: "ig_followers", taskType: "follow", title: "Instagram Followers", desc: "Real followers on your Instagram account", fromUsd: 0.75, rangeLabel: "50 – 10,000 followers", delivery: "~48h" },
    { id: "ig_likes", taskType: "like", title: "Instagram Likes", desc: "Real likes on your Instagram post", fromUsd: 0.5, rangeLabel: "50 – 50,000 likes", delivery: "~24h" },
    { id: "ig_comments", taskType: "comment", title: "Instagram Comments", desc: "Real comments on your Instagram post", fromUsd: 0.25, rangeLabel: "10 – 5,000 comments", delivery: "~48h" },
    { id: "ig_views", taskType: "view", title: "Instagram Video Views", desc: "Real views on your Instagram video or reel", fromUsd: 0.5, rangeLabel: "100 – 100,000 views", delivery: "~24h" },
  ],
  youtube: [
    { id: "yt_subs", taskType: "subscribe", title: "YouTube Subscribers", desc: "Real subscribers on your YouTube channel", fromUsd: 1.0, rangeLabel: "50 – 10,000 subscribers", delivery: "~72h" },
    { id: "yt_views", taskType: "view", title: "YouTube Views", desc: "Real views on your YouTube video", fromUsd: 0.8, rangeLabel: "100 – 100,000 views", delivery: "~48h" },
    { id: "yt_likes", taskType: "like", title: "YouTube Likes", desc: "Real likes on your YouTube video", fromUsd: 0.6, rangeLabel: "50 – 50,000 likes", delivery: "~48h" },
    { id: "yt_comments", taskType: "comment", title: "YouTube Comments", desc: "Real comments on your YouTube video", fromUsd: 0.3, rangeLabel: "10 – 5,000 comments", delivery: "~72h" },
  ],
  tiktok: [
    { id: "tt_followers", taskType: "follow", title: "TikTok Followers", desc: "Real followers on your TikTok account", fromUsd: 0.75, rangeLabel: "50 – 10,000 followers", delivery: "~48h" },
    { id: "tt_likes", taskType: "like", title: "TikTok Likes", desc: "Real likes on your TikTok video", fromUsd: 0.4, rangeLabel: "50 – 50,000 likes", delivery: "~24h" },
    { id: "tt_views", taskType: "view", title: "TikTok Views", desc: "Real views on your TikTok video", fromUsd: 0.5, rangeLabel: "100 – 100,000 views", delivery: "~24h" },
    { id: "tt_comments", taskType: "comment", title: "TikTok Comments", desc: "Real comments on your TikTok video", fromUsd: 0.3, rangeLabel: "10 – 5,000 comments", delivery: "~48h" },
  ],
  x: [
    { id: "x_followers", taskType: "follow", title: "X Followers", desc: "Real followers on your X account", fromUsd: 0.9, rangeLabel: "50 – 10,000 followers", delivery: "~48h" },
    { id: "x_likes", taskType: "like", title: "X Likes", desc: "Real likes on your X post", fromUsd: 0.5, rangeLabel: "50 – 50,000 likes", delivery: "~24h" },
    { id: "x_reposts", taskType: "repost", title: "X Reposts", desc: "Real reposts on your X post", fromUsd: 0.75, rangeLabel: "50 – 50,000 reposts", delivery: "~24h" },
    { id: "x_comments", taskType: "comment", title: "X Comments", desc: "Real comments on your X post", fromUsd: 0.3, rangeLabel: "10 – 5,000 comments", delivery: "~48h" },
  ],
  facebook: [
    { id: "fb_page", taskType: "like", title: "Facebook Page Likes", desc: "Real likes on your Facebook page", fromUsd: 0.75, rangeLabel: "50 – 10,000 likes", delivery: "~48h" },
    { id: "fb_post", taskType: "like", title: "Facebook Post Likes", desc: "Real likes on your Facebook post", fromUsd: 0.5, rangeLabel: "50 – 50,000 likes", delivery: "~24h" },
    { id: "fb_followers", taskType: "follow", title: "Facebook Followers", desc: "Real followers on your Facebook profile", fromUsd: 0.7, rangeLabel: "50 – 10,000 followers", delivery: "~48h" },
    { id: "fb_comments", taskType: "comment", title: "Facebook Comments", desc: "Real comments on your Facebook post", fromUsd: 0.3, rangeLabel: "10 – 5,000 comments", delivery: "~48h" },
  ],
  linkedin: [
    { id: "li_followers", taskType: "follow", title: "LinkedIn Followers", desc: "Real followers on your LinkedIn profile or company page", fromUsd: 1.25, rangeLabel: "50 – 10,000 followers", delivery: "~72h" },
    { id: "li_likes", taskType: "like", title: "LinkedIn Post Likes", desc: "Real likes on your LinkedIn post", fromUsd: 0.75, rangeLabel: "50 – 10,000 likes", delivery: "~48h" },
    { id: "li_comments", taskType: "comment", title: "LinkedIn Comments", desc: "Real comments on your LinkedIn post", fromUsd: 0.4, rangeLabel: "10 – 2,000 comments", delivery: "~72h" },
  ],
  threads: [
    { id: "th_followers", taskType: "follow", title: "Threads Followers", desc: "Real followers on your Threads account", fromUsd: 0.75, rangeLabel: "50 – 10,000 followers", delivery: "~48h" },
    { id: "th_likes", taskType: "like", title: "Threads Likes", desc: "Real likes on your Threads post", fromUsd: 0.5, rangeLabel: "50 – 50,000 likes", delivery: "~24h" },
    { id: "th_reposts", taskType: "repost", title: "Threads Reposts", desc: "Real reposts on your Threads post", fromUsd: 0.6, rangeLabel: "50 – 20,000 reposts", delivery: "~48h" },
  ],
  telegram: [
    { id: "tg_members", taskType: "join", title: "Telegram Channel Members", desc: "Real members for your Telegram channel", fromUsd: 0.6, rangeLabel: "50 – 10,000 members", delivery: "~48h" },
    { id: "tg_group", taskType: "join", title: "Telegram Group Members", desc: "Real members for your Telegram group", fromUsd: 0.55, rangeLabel: "50 – 10,000 members", delivery: "~48h" },
  ],
  whatsapp: [
    { id: "wa_channel", taskType: "join", title: "WhatsApp Channel Growth", desc: "Real followers for your WhatsApp channel", fromUsd: 0.7, rangeLabel: "50 – 5,000 members", delivery: "~72h" },
    { id: "wa_group", taskType: "join", title: "WhatsApp Group Members", desc: "Real members for your WhatsApp group", fromUsd: 0.65, rangeLabel: "50 – 5,000 members", delivery: "~72h" },
  ],
  discord: [
    { id: "dc_members", taskType: "join", title: "Discord Server Members", desc: "Real members for your Discord server", fromUsd: 0.7, rangeLabel: "50 – 10,000 members", delivery: "~48h" },
    { id: "dc_boost", taskType: "join", title: "Discord Engagement", desc: "Active engagement in your server", fromUsd: 0.5, rangeLabel: "50 – 5,000 actions", delivery: "~48h" },
  ],
  spotify: [
    { id: "sp_plays", taskType: "view", title: "Spotify Plays", desc: "Real plays on your Spotify track", fromUsd: 0.5, rangeLabel: "100 – 100,000 plays", delivery: "~48h" },
    { id: "sp_followers", taskType: "follow", title: "Spotify Followers", desc: "Real followers on your Spotify profile", fromUsd: 0.7, rangeLabel: "50 – 10,000 followers", delivery: "~72h" },
    { id: "sp_playlist", taskType: "follow", title: "Playlist Promotion", desc: "Add your track to curated playlists", fromUsd: 1.0, rangeLabel: "1 – 50 playlists", delivery: "~96h" },
    { id: "sp_saves", taskType: "like", title: "Spotify Saves", desc: "Real saves on your Spotify track", fromUsd: 0.4, rangeLabel: "50 – 20,000 saves", delivery: "~48h" },
  ],
  soundcloud: [
    { id: "sc_plays", taskType: "view", title: "SoundCloud Plays", desc: "Real plays on your SoundCloud track", fromUsd: 0.45, rangeLabel: "100 – 100,000 plays", delivery: "~48h" },
    { id: "sc_followers", taskType: "follow", title: "SoundCloud Followers", desc: "Real followers on your SoundCloud", fromUsd: 0.6, rangeLabel: "50 – 10,000 followers", delivery: "~72h" },
    { id: "sc_likes", taskType: "like", title: "SoundCloud Likes", desc: "Real likes on your track", fromUsd: 0.4, rangeLabel: "50 – 50,000 likes", delivery: "~48h" },
  ],
  audiomack: [
    { id: "am_plays", taskType: "view", title: "Audiomack Plays", desc: "Real plays on your Audiomack track", fromUsd: 0.45, rangeLabel: "100 – 100,000 plays", delivery: "~48h" },
    { id: "am_followers", taskType: "follow", title: "Audiomack Followers", desc: "Real followers on Audiomack", fromUsd: 0.55, rangeLabel: "50 – 10,000 followers", delivery: "~72h" },
    { id: "am_likes", taskType: "like", title: "Audiomack Likes", desc: "Real likes on your track", fromUsd: 0.35, rangeLabel: "50 – 50,000 likes", delivery: "~48h" },
  ],
  app_review: [
    { id: "ar_ios", taskType: "review", title: "iOS App Reviews", desc: "Real reviews on the App Store", fromUsd: 1.5, rangeLabel: "5 – 500 reviews", delivery: "~96h" },
    { id: "ar_android", taskType: "review", title: "Android App Reviews", desc: "Real reviews on Google Play", fromUsd: 1.4, rangeLabel: "5 – 500 reviews", delivery: "~96h" },
    { id: "ar_ratings", taskType: "review", title: "App Ratings", desc: "Star ratings for your mobile app", fromUsd: 1.0, rangeLabel: "10 – 1,000 ratings", delivery: "~72h" },
  ],
  google: [
    { id: "gb_reviews", taskType: "review", title: "Google Business Reviews", desc: "Real Google Business reviews", fromUsd: 1.2, rangeLabel: "5 – 200 reviews", delivery: "~96h" },
    { id: "gb_seo", taskType: "view", title: "Local SEO Boost", desc: "Visibility boost for your Google listing", fromUsd: 2.0, rangeLabel: "1 package", delivery: "~7d" },
  ],
  website: [
    { id: "web_traffic", taskType: "view", title: "Website Traffic", desc: "Real visitors to your website or landing page", fromUsd: 0.3, rangeLabel: "100 – 100,000 visits", delivery: "~48h" },
    { id: "web_signups", taskType: "join", title: "Website Sign-ups", desc: "Real user registrations on your website", fromUsd: 0.4, rangeLabel: "10 – 5,000 sign-ups", delivery: "~72h" },
    { id: "web_clicks", taskType: "view", title: "Link Clicks", desc: "Real clicks on your link or ad", fromUsd: 0.25, rangeLabel: "50 – 50,000 clicks", delivery: "~24h" },
  ],
  survey: [
    { id: "sv_responses", taskType: "join", title: "Survey Responses", desc: "Real people to complete your online survey", fromUsd: 0.5, rangeLabel: "10 – 5,000 responses", delivery: "~72h" },
    { id: "sv_votes", taskType: "like", title: "Poll Votes", desc: "Real votes on your online poll or contest", fromUsd: 0.5, rangeLabel: "50 – 50,000 votes", delivery: "~24h" },
  ],
  pinterest: [
    { id: "pin_followers", taskType: "follow", title: "Pinterest Followers", desc: "Real followers on your Pinterest account", fromUsd: 0.75, rangeLabel: "50 – 10,000 followers", delivery: "~72h" },
    { id: "pin_saves", taskType: "like", title: "Pinterest Repins/Saves", desc: "Real saves on your Pinterest pin", fromUsd: 0.5, rangeLabel: "50 – 50,000 saves", delivery: "~48h" },
  ],
  reddit: [
    { id: "rd_upvotes", taskType: "like", title: "Reddit Upvotes", desc: "Real upvotes on your Reddit post", fromUsd: 0.4, rangeLabel: "50 – 10,000 upvotes", delivery: "~48h" },
    { id: "rd_comments", taskType: "comment", title: "Reddit Comments", desc: "Real comments on your Reddit post", fromUsd: 0.35, rangeLabel: "10 – 2,000 comments", delivery: "~72h" },
  ],
  twitch: [
    { id: "tw_followers", taskType: "follow", title: "Twitch Followers", desc: "Real followers on your Twitch channel", fromUsd: 0.8, rangeLabel: "50 – 10,000 followers", delivery: "~48h" },
    { id: "tw_views", taskType: "view", title: "Twitch Views", desc: "Real views on your Twitch stream/VOD", fromUsd: 0.55, rangeLabel: "100 – 50,000 views", delivery: "~48h" },
    { id: "tw_chat", taskType: "comment", title: "Twitch Chat Engagement", desc: "Active chat during your stream", fromUsd: 0.6, rangeLabel: "50 – 5,000 messages", delivery: "~24h" },
  ],
};

function AdvertisePage() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [service, setService] = useState<ServiceDef | null>(null);
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("");
  const [reward, setReward] = useState("");
  const [slots, setSlots] = useState("100");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, Platform[]>();
    for (const p of PLATFORM_ORDER) {
      const cat = PLATFORM_META[p].category;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return map;
  }, []);

  async function publish() {
    if (!platform || !service) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = Number(reward || service.fromUsd);
      const s = Math.max(1, Number(slots) || 100);
      const task = await ownerCreateTask({
        data: {
          platform,
          title: title.trim() || service.title,
          advertiser: "TASKORA",
          reward: r,
          slots: s,
          steps: ["Open the target link", `Complete: ${service.taskType}`, "Return and submit proof"],
          proof: platform === "telegram" ? "auto" : "screenshot",
          link: link.trim() || undefined,
        },
      });
      setMsg(`Published · ${task.id.slice(0, 8)}… Live in marketplace when active.`);
      setService(null);
      setPlatform(null);
      setTitle("");
      setLink("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Publish failed (owner role required)");
    } finally {
      setBusy(false);
    }
  }

  // —— Service detail / order form ——
  if (platform && service) {
    const meta = PLATFORM_META[platform];
    return (
      <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
        <button
          type="button"
          onClick={() => setService(null)}
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-white/50"
        >
          <ArrowLeft className="size-3.5" /> Back to {meta.label}
        </button>

        <div className={`mb-4 overflow-hidden rounded-2xl bg-gradient-to-r ${meta.bg} p-4`}>
          <div className="flex items-center gap-3">
            <PlatformLogo platform={platform} size={48} />
            <div>
              <p className="text-sm font-bold">{service.title}</p>
              <p className="text-[11px] text-white/80">{service.desc}</p>
            </div>
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-white/10 bg-[#12141c] p-4">
          <div className="flex items-center justify-between text-xs text-white/45">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" /> {service.delivery} delivery
            </span>
            <span>{service.rangeLabel}</span>
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Campaign title (optional)"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-sky-400/40"
          />
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="Target URL (profile, post, video…)"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-sky-400/40"
          />
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">Reward / user</label>
              <input
                value={reward}
                onChange={(e) => setReward(e.target.value)}
                placeholder={`From $${service.fromUsd.toFixed(2)}`}
                inputMode="decimal"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-sky-400/40"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-[10px] uppercase tracking-wider text-white/40">Slots</label>
              <input
                value={slots}
                onChange={(e) => setSlots(e.target.value)}
                inputMode="numeric"
                className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm outline-none focus:border-sky-400/40"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void publish()}
            className="w-full rounded-2xl bg-gradient-to-r from-sky-400 to-blue-500 py-3.5 text-sm font-bold text-[#0a0c12] disabled:opacity-50"
          >
            {busy ? "Publishing…" : "Publish campaign"}
          </button>
          {msg ? <p className="text-center text-xs text-amber-200/90">{msg}</p> : null}
        </div>
      </main>
    );
  }

  // —— Platform services list ——
  if (platform) {
    const meta = PLATFORM_META[platform];
    const list = SERVICES[platform] ?? [];
    return (
      <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
        <button
          type="button"
          onClick={() => setPlatform(null)}
          className="mb-3 inline-flex items-center gap-1.5 text-xs text-white/50"
        >
          <ArrowLeft className="size-3.5" /> All Platforms
        </button>

        <div className={`mb-4 overflow-hidden rounded-2xl bg-gradient-to-r ${meta.bg} p-4`}>
          <div className="flex items-center gap-3">
            <PlatformLogo platform={platform} size={52} />
            <div>
              <p className="text-base font-bold">{meta.label} Services</p>
              <p className="text-[11px] text-white/85">{meta.blurb}</p>
            </div>
          </div>
        </div>

        <p className="mb-3 text-xs text-white/45">Select a service to grow your {meta.label} presence</p>

        <div className="space-y-2.5">
          {list.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setService(s);
                setReward(String(s.fromUsd));
                setMsg(null);
              }}
              className="flex w-full items-start gap-3 rounded-2xl border border-white/8 bg-[#12141c] p-3.5 text-left transition active:scale-[0.99]"
            >
              <PlatformLogo platform={platform} size={40} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{s.title}</p>
                <p className="mt-0.5 text-[11px] text-white/45">{s.desc}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="font-bold text-emerald-300">From ${s.fromUsd.toFixed(2)}</span>
                  <span className="text-white/35">·</span>
                  <span className="text-white/45">{s.rangeLabel}</span>
                  <span className="text-white/35">·</span>
                  <span className="inline-flex items-center gap-1 text-white/45">
                    <Clock className="size-3" /> {s.delivery}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </main>
    );
  }

  // —— Platform grid (EarnIT-style) ——
  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      {/* Hero banner */}
      <div className="relative mb-5 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 p-5 shadow-lg">
        <div className="pointer-events-none absolute -right-6 -top-6 size-28 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-8 left-10 size-24 rounded-full bg-white/10" />
        <p className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
          <CheckCircle2 className="size-3" /> 100% real engagement
        </p>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight">Organic Boost</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-white/90">
          Real engagement from active TASKORA members. Genuine followers, likes and comments from real people.
        </p>
        <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/80">
          <Sparkles className="size-3.5" /> Powered by verified taskers
        </p>
      </div>

      <h2 className="text-lg font-bold">Choose a platform</h2>
      <p className="mt-0.5 text-xs text-white/45">Pick the social platform you want to grow</p>

      {[...grouped.entries()].map(([cat, platforms]) => (
        <section key={cat} className="mt-5">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">
              {CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}
            </p>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-white/40">
              {platforms.length}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {platforms.map((p) => {
              const m = PLATFORM_META[p];
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setPlatform(p);
                    setMsg(null);
                  }}
                  className="flex flex-col items-start rounded-2xl border border-white/8 bg-[#12141c] p-3.5 text-left transition active:scale-[0.98]"
                >
                  <PlatformLogo platform={p} size={48} />
                  <p className="mt-3 text-sm font-bold">{m.label}</p>
                  <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-white/40">{m.blurb}</p>
                  <span
                    className="mt-2 rounded-full px-2 py-0.5 text-[10px] font-bold"
                    style={{ color: m.color, backgroundColor: `${m.color}18` }}
                  >
                    {m.services} services
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}

      {msg ? (
        <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200/90">
          {msg}
        </p>
      ) : null}
    </main>
  );
}
