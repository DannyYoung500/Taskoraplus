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
import { createAdvertiseTask } from "@/lib/advertise-task.functions";

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
    { id: "ig_views", taskType: "watch", title: "Instagram Video Views", desc: "Watch your Instagram video or reel", fromUsd: 0.5, rangeLabel: "100 – 100,000 views", delivery: "~24h" },
  ],
  youtube: [
    { id: "yt_subs", taskType: "subscribe", title: "YouTube Subscribers", desc: "Real subscribers on your YouTube channel", fromUsd: 1.0, rangeLabel: "50 – 10,000 subscribers", delivery: "~72h" },
    { id: "yt_views", taskType: "watch", title: "YouTube Watch", desc: "Watch your YouTube video to completion", fromUsd: 0.8, rangeLabel: "100 – 100,000 watches", delivery: "~48h" },
    { id: "yt_likes", taskType: "like", title: "YouTube Likes", desc: "Real likes on your YouTube video", fromUsd: 0.6, rangeLabel: "50 – 50,000 likes", delivery: "~48h" },
    { id: "yt_comments", taskType: "comment", title: "YouTube Comments", desc: "Real comments on your YouTube video", fromUsd: 0.3, rangeLabel: "10 – 5,000 comments", delivery: "~72h" },
  ],
  tiktok: [
    { id: "tt_followers", taskType: "follow", title: "TikTok Followers", desc: "Real followers on your TikTok account", fromUsd: 0.75, rangeLabel: "50 – 10,000 followers", delivery: "~48h" },
    { id: "tt_likes", taskType: "like", title: "TikTok Likes", desc: "Real likes on your TikTok video", fromUsd: 0.4, rangeLabel: "50 – 50,000 likes", delivery: "~24h" },
    { id: "tt_views", taskType: "watch", title: "TikTok Watch", desc: "Watch your TikTok video to completion", fromUsd: 0.5, rangeLabel: "100 – 100,000 watches", delivery: "~24h" },
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
    { id: "sp_plays", taskType: "play", title: "Spotify Plays", desc: "Real plays on your Spotify track", fromUsd: 0.5, rangeLabel: "100 – 100,000 plays", delivery: "~48h" },
    { id: "sp_followers", taskType: "follow", title: "Spotify Followers", desc: "Real followers on your Spotify profile", fromUsd: 0.7, rangeLabel: "50 – 10,000 followers", delivery: "~72h" },
    { id: "sp_playlist", taskType: "follow", title: "Playlist Promotion", desc: "Add your track to curated playlists", fromUsd: 1.0, rangeLabel: "1 – 50 playlists", delivery: "~96h" },
    { id: "sp_saves", taskType: "like", title: "Spotify Saves", desc: "Real saves on your Spotify track", fromUsd: 0.4, rangeLabel: "50 – 20,000 saves", delivery: "~48h" },
  ],
  soundcloud: [
    { id: "sc_plays", taskType: "play", title: "SoundCloud Plays", desc: "Real plays on your SoundCloud track", fromUsd: 0.45, rangeLabel: "100 – 100,000 plays", delivery: "~48h" },
    { id: "sc_followers", taskType: "follow", title: "SoundCloud Followers", desc: "Real followers on your SoundCloud", fromUsd: 0.6, rangeLabel: "50 – 10,000 followers", delivery: "~72h" },
    { id: "sc_likes", taskType: "like", title: "SoundCloud Likes", desc: "Real likes on your track", fromUsd: 0.4, rangeLabel: "50 – 50,000 likes", delivery: "~48h" },
  ],
  audiomack: [
    { id: "am_plays", taskType: "play", title: "Audiomack Plays", desc: "Real plays on your Audiomack track", fromUsd: 0.45, rangeLabel: "100 – 100,000 plays", delivery: "~48h" },
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
    { id: "gb_seo", taskType: "visit", title: "Local SEO Boost", desc: "Visibility boost for your Google listing", fromUsd: 2.0, rangeLabel: "1 package", delivery: "~7d" },
  ],
  website: [
    { id: "web_traffic", taskType: "visit", title: "Website Traffic", desc: "Real visitors to your website or landing page", fromUsd: 0.3, rangeLabel: "100 – 100,000 visits", delivery: "~48h" },
    { id: "web_signups", taskType: "signup", title: "Website Sign-ups", desc: "Real user registrations on your website", fromUsd: 0.4, rangeLabel: "10 – 5,000 sign-ups", delivery: "~72h" },
    { id: "web_clicks", taskType: "visit", title: "Link Clicks", desc: "Real clicks on your link or ad", fromUsd: 0.25, rangeLabel: "50 – 50,000 clicks", delivery: "~24h" },
  ],
  survey: [
    { id: "sv_responses", taskType: "signup", title: "Survey Responses", desc: "Real people to complete your online survey", fromUsd: 0.5, rangeLabel: "10 – 5,000 responses", delivery: "~72h" },
    { id: "sv_votes", taskType: "vote", title: "Poll Votes", desc: "Real votes on your online poll or contest", fromUsd: 0.5, rangeLabel: "50 – 50,000 votes", delivery: "~24h" },
  ],
  pinterest: [
    { id: "pin_followers", taskType: "follow", title: "Pinterest Followers", desc: "Real followers on your Pinterest account", fromUsd: 0.75, rangeLabel: "50 – 10,000 followers", delivery: "~72h" },
    { id: "pin_saves", taskType: "save", title: "Pinterest Repins/Saves", desc: "Real saves on your Pinterest pin", fromUsd: 0.5, rangeLabel: "50 – 50,000 saves", delivery: "~48h" },
  ],
  reddit: [
    { id: "rd_upvotes", taskType: "like", title: "Reddit Upvotes", desc: "Real upvotes on your Reddit post", fromUsd: 0.4, rangeLabel: "50 – 10,000 upvotes", delivery: "~48h" },
    { id: "rd_comments", taskType: "comment", title: "Reddit Comments", desc: "Real comments on your Reddit post", fromUsd: 0.35, rangeLabel: "10 – 2,000 comments", delivery: "~72h" },
  ],
  twitch: [
    { id: "tw_followers", taskType: "follow", title: "Twitch Followers", desc: "Real followers on your Twitch channel", fromUsd: 0.8, rangeLabel: "50 – 10,000 followers", delivery: "~48h" },
    { id: "tw_views", taskType: "watch", title: "Twitch Watch", desc: "Watch your Twitch stream/VOD", fromUsd: 0.55, rangeLabel: "100 – 50,000 watches", delivery: "~48h" },
    { id: "tw_chat", taskType: "comment", title: "Twitch Chat Engagement", desc: "Active chat during your stream", fromUsd: 0.6, rangeLabel: "50 – 5,000 messages", delivery: "~24h" },
  ],
};

function actionLabel(taskType: string) {
  const labels: Record<string, string> = {
    watch: "Watch",
    follow: "Follow",
    like: "Like",
    comment: "Comment",
    repost: "Repost",
    subscribe: "Subscribe",
    join: "Join",
    review: "Review",
    visit: "Visit",
    signup: "Sign up",
    vote: "Vote",
    save: "Save",
    play: "Play",
  };
  return labels[taskType] ?? "Task";
}

function AdvertisePage() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [service, setService] = useState<ServiceDef | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [warningText, setWarningText] = useState("");
  const [link, setLink] = useState("");
  const [reward, setReward] = useState("");
  const [slots, setSlots] = useState("100");
  const [proofRequirements, setProofRequirements] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [screenshotsRequired, setScreenshotsRequired] = useState("0");
  const [featured, setFeatured] = useState(false);
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

  function resetTaskDetails() {
    setTitle("");
    setDescription("");
    setInstructions("");
    setWarningText("");
    setLink("");
    setReward("");
    setSlots("100");
    setProofRequirements([]);
    setDifficulty("easy");
    setScreenshotsRequired("0");
    setFeatured(false);
    setMsg(null);
  }

  function selectService(next: ServiceDef) {
    setService(next);
    setReward(String(next.fromUsd));
    setProofRequirements(next.taskType === "watch" ? ["watch_completion"] : []);
    setScreenshotsRequired(next.taskType === "watch" ? "0" : "1");
    setInstructions(
      next.taskType === "watch"
        ? "Open the target video, start from the beginning, and watch it through to completion. Return to TASKORA when the watch requirement is completed."
        : "Complete the selected action on the target. Follow the instructions exactly, then return to TASKORA and submit the requested proof.",
    );
    setWarningText(
      next.taskType === "watch"
        ? "Do not skip ahead. TASKORA will unlock submission only after supported video playback reaches completion."
        : "Complete only the action requested for the selected platform.",
    );
    setDescription(next.desc);
    setMsg(null);
  }

  async function publish() {
    if (!platform || !service) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = Number(reward || service.fromUsd);
      const s = Math.max(1, Number(slots) || 100);
      const screenshotCount = Math.max(0, Number(screenshotsRequired) || 0);
      const requirements = proofRequirements.filter(Boolean);
      const proof = requirements.includes("screenshot") ? "screenshot" : "auto";
      const steps = [
        "Open the target link",
        ...(instructions.trim() ? [instructions.trim()] : []),
        ...(service.taskType === "watch" ? ["Watch the video from start to finish"] : [`Complete: ${actionLabel(service.taskType)}`]),
        "Return to TASKORA and submit proof",
      ];

      const task = await createAdvertiseTask({
        data: {
          platform,
          taskType: service.taskType,
          title: title.trim() || service.title,
          description,
          instructions,
          warningText,
          reward: r,
          slots: s,
          steps,
          proof,
          proofRequirements: requirements,
          difficulty,
          screenshotsRequired: screenshotCount,
          featured,
          link: link.trim() || undefined,
        },
      });
      setMsg(`Created · ${task.id.slice(0, 8)}… Ready for the marketplace.`);
      setService(null);
      setPlatform(null);
      resetTaskDetails();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Create task failed");
    } finally {
      setBusy(false);
    }
  }

  if (platform && service) {
    const meta = PLATFORM_META[platform];
    const total = Math.max(1, Number(slots) || 0) * Math.max(0, Number(reward) || 0);
    const action = actionLabel(service.taskType);
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
              <p className="text-[11px] text-white/80">{action} · {service.desc}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-white/10 bg-[#12141c] p-4">
          <div>
            <p className="text-sm font-bold">Task Details</p>
            <p className="mt-1 text-[11px] text-white/40">Use the same task format for every action. The selected platform and action stay locked together.</p>
          </div>

          <Field label="Task Title">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`e.g. ${action} my ${meta.label} ${service.taskType === "watch" ? "video" : "account"}`} className="field" />
          </Field>
          <Field label="Description">
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe what earners need to do…" className="field min-h-20 resize-none" />
          </Field>
          <Field label="Instructions">
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="Give clear step-by-step instructions…" className="field min-h-24 resize-none" />
          </Field>
          <Field label="Warning Text">
            <input value={warningText} onChange={(e) => setWarningText(e.target.value)} placeholder="Optional warning or important rule" className="field" />
          </Field>
          <Field label="Target URL">
            <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" inputMode="url" className="field" />
          </Field>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Reward Per Person (USD)">
              <input value={reward} onChange={(e) => setReward(e.target.value)} inputMode="decimal" className="field" />
            </Field>
            <Field label="Quantity / Slots">
              <input value={slots} onChange={(e) => setSlots(e.target.value)} inputMode="numeric" className="field" />
            </Field>
          </div>

          <div>
            <label className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-white/40">Proof Requirements</label>
            <div className="flex flex-wrap gap-2">
              {[
                ["screenshot", "Screenshot"],
                ["text", "Text / Comment"],
                ["link", "Link / URL"],
                ["watch_completion", "Watch completion"],
              ].map(([value, label]) => {
                const checked = proofRequirements.includes(value);
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setProofRequirements((current) => checked ? current.filter((x) => x !== value) : [...current, value])}
                    className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold ${checked ? "border-emerald-300/50 bg-emerald-300/15 text-emerald-200" : "border-white/10 bg-white/5 text-white/50"}`}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Field label="Difficulty">
              <div className="flex rounded-xl border border-white/10 bg-black/30 p-1">
                {(["easy", "medium", "hard"] as const).map((level) => (
                  <button key={level} type="button" onClick={() => setDifficulty(level)} className={`flex-1 rounded-lg px-2 py-2 text-[10px] font-bold capitalize ${difficulty === level ? "bg-emerald-400/20 text-emerald-200" : "text-white/35"}`}>
                    {level}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Screenshots Required">
              <select value={screenshotsRequired} onChange={(e) => setScreenshotsRequired(e.target.value)} className="field">
                {[0, 1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </Field>
          </div>

          <button type="button" onClick={() => setFeatured((v) => !v)} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left ${featured ? "border-amber-300/30 bg-amber-300/10" : "border-white/10 bg-black/20"}`}>
            <span className={`mt-0.5 size-4 rounded border ${featured ? "border-amber-300 bg-amber-300" : "border-white/25"}`} />
            <span>
              <span className="block text-xs font-bold">Feature this task for more visibility</span>
              <span className="mt-0.5 block text-[10px] leading-4 text-white/40">Places the task in the featured section when that marketplace slot is enabled.</span>
            </span>
          </button>

          <div className="rounded-xl border border-white/8 bg-black/20 p-3">
            <p className="text-xs font-bold">Order Summary</p>
            <div className="mt-2 space-y-1.5 text-[11px] text-white/50">
              <div className="flex justify-between"><span>{service.title}</span><span>{sNumber(slots)} slots</span></div>
              <div className="flex justify-between"><span>Action</span><span className="text-white">{action}</span></div>
              <div className="flex justify-between"><span>Reward / person</span><span>${Number(reward || service.fromUsd).toFixed(2)}</span></div>
              <div className="flex justify-between"><span>Delivery</span><span>{service.delivery}</span></div>
              <div className="mt-2 flex justify-between border-t border-white/8 pt-2 text-sm font-bold text-emerald-300"><span>Estimated task budget</span><span>${total.toFixed(2)}</span></div>
            </div>
          </div>

          <button
            type="button"
            disabled={busy || !link.trim() || !title.trim() || !Number(reward) || !Number(slots)}
            onClick={() => void publish()}
            className="w-full rounded-2xl bg-gradient-to-r from-emerald-400 to-green-500 py-3.5 text-sm font-bold text-[#07100b] disabled:opacity-40"
          >
            {busy ? "Creating…" : `Create Task · $${total.toFixed(2)}`}
          </button>
          {msg ? <p className="text-center text-xs text-amber-200/90">{msg}</p> : null}
        </div>
      </main>
    );
  }

  if (platform) {
    const meta = PLATFORM_META[platform];
    const list = SERVICES[platform] ?? [];
    return (
      <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
        <button type="button" onClick={() => setPlatform(null)} className="mb-3 inline-flex items-center gap-1.5 text-xs text-white/50"><ArrowLeft className="size-3.5" /> All Platforms</button>
        <div className={`mb-4 overflow-hidden rounded-2xl bg-gradient-to-r ${meta.bg} p-4`}>
          <div className="flex items-center gap-3"><PlatformLogo platform={platform} size={52} /><div><p className="text-base font-bold">{meta.label} Services</p><p className="text-[11px] text-white/85">{meta.blurb}</p></div></div>
        </div>
        <p className="mb-3 text-xs text-white/45">Select an action for {meta.label}. The task details format comes next.</p>
        <div className="space-y-2.5">
          {list.map((s) => (
            <button key={s.id} type="button" onClick={() => selectService(s)} className="flex w-full items-start gap-3 rounded-2xl border border-white/8 bg-[#12141c] p-3.5 text-left transition active:scale-[0.99]">
              <PlatformLogo platform={platform} size={40} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{s.title}</p><span className="rounded-full bg-emerald-300/10 px-2 py-0.5 text-[10px] font-bold text-emerald-200">{actionLabel(s.taskType)}</span></div>
                <p className="mt-0.5 text-[11px] text-white/45">{s.desc}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]"><span className="font-bold text-emerald-300">From ${s.fromUsd.toFixed(2)}</span><span className="text-white/35">·</span><span className="text-white/45">{s.rangeLabel}</span><span className="text-white/35">·</span><span className="inline-flex items-center gap-1 text-white/45"><Clock className="size-3" /> {s.delivery}</span></div>
              </div>
            </button>
          ))}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-md bg-[#05070c] px-4 pb-28 pt-5 text-white">
      <div className="relative mb-5 overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600 p-5 shadow-lg">
        <div className="pointer-events-none absolute -right-6 -top-6 size-28 rounded-full bg-white/10" /><div className="pointer-events-none absolute -bottom-8 left-10 size-24 rounded-full bg-white/10" />
        <p className="inline-flex items-center gap-1.5 rounded-full bg-black/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white"><CheckCircle2 className="size-3" /> 100% real engagement</p>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight">Organic Boost</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-white/90">Real engagement from active TASKORA members. Create a clear task with the exact platform, action, instructions and proof requirements you need.</p>
        <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/80"><Sparkles className="size-3.5" /> Powered by verified taskers</p>
      </div>
      <h2 className="text-lg font-bold">Choose a platform</h2>
      <p className="mt-0.5 text-xs text-white/45">The selected platform controls which actions are available.</p>
      {[...grouped.entries()].map(([cat, platforms]) => (
        <section key={cat} className="mt-5">
          <div className="mb-2.5 flex items-center justify-between"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">{CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS]}</p><span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-bold text-white/40">{platforms.length}</span></div>
          <div className="grid grid-cols-2 gap-2.5">
            {platforms.map((p) => { const m = PLATFORM_META[p]; return (
              <button key={p} type="button" onClick={() => { setPlatform(p); setMsg(null); }} className="flex flex-col items-start rounded-2xl border border-white/8 bg-[#12141c] p-3.5 text-left transition active:scale-[0.98]">
                <PlatformLogo platform={p} size={48} /><p className="mt-3 text-sm font-bold">{m.label}</p><p className="mt-1 line-clamp-2 text-[10px] leading-snug text-white/40">{m.blurb}</p><span className="mt-2 rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ color: m.color, backgroundColor: `${m.color}18` }}>{m.services} services</span>
              </button>
            ); })}
          </div>
        </section>
      ))}
      {msg ? <p className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-200/90">{msg}</p> : null}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-white/40">{label}</label>{children}</div>;
}

function sNumber(value: string) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n.toLocaleString() : "0";
}
