/** Platform service catalog for Advertise — platform-matched only */
import type { Platform } from "@/components/PlatformIcon";

export type ServiceDef = {
  id: string;
  taskType: string;
  title: string;
  desc: string;
  fromUsd: number;
  unit: string;
  minQty: number;
  maxQty: number;
  qtyChips: number[];
  delivery: string;
  linkPlaceholder: string;
  suggestedTitles: string[];
  defaultSteps: string[];
  defaultWarning: string;
};

export const PLATFORM_FEE = 0.2;
export const FEATURE_FEE_USD = 5;

function S(
  id: string,
  taskType: string,
  title: string,
  desc: string,
  fromUsd: number,
  unit: string,
  minQty: number,
  maxQty: number,
  qtyChips: number[],
  delivery: string,
  linkPlaceholder: string,
  suggestedTitles: string[],
  defaultSteps: string[],
  defaultWarning: string,
): ServiceDef {
  return {
    id,
    taskType,
    title,
    desc,
    fromUsd,
    unit,
    minQty,
    maxQty,
    qtyChips,
    delivery,
    linkPlaceholder,
    suggestedTitles,
    defaultSteps,
    defaultWarning,
  };
}

export const SERVICES: Record<Platform, ServiceDef[]> = {
  instagram: [
    S("ig_followers", "follow", "Instagram Followers", "Real followers on your Instagram account", 0.08, "followers", 50, 10000, [50, 100, 250, 500, 1000, 5000], "~48h", "https://www.instagram.com/yourusername", ["Follow this Instagram account"], ["Open the Instagram profile link", "Tap Follow", "Screenshot the followed profile", "Submit proof"], "Real engagement only. Do not unfollow after proof."),
    S("ig_likes", "like", "Instagram Likes", "Real likes on your Instagram post", 0.03, "likes", 50, 50000, [50, 100, 250, 500, 1000, 5000], "~24h", "https://www.instagram.com/p/…", ["Like this Instagram post"], ["Open the post", "Like the post", "Screenshot", "Submit proof"], "Do not unlike after submitting."),
    S("ig_comments", "comment", "Instagram Comments", "Real comments on your Instagram post", 0.12, "comments", 10, 5000, [10, 25, 50, 100, 250], "~48h", "https://www.instagram.com/p/…", ["Comment on this Instagram post"], ["Open the post", "Write a relevant comment", "Screenshot", "Submit proof"], "Spam or emoji-only comments may be rejected."),
    S("ig_views", "view", "Instagram Video Views", "Real views on your Instagram reel or video", 0.01, "views", 100, 100000, [100, 500, 1000, 5000, 10000], "~24h", "https://www.instagram.com/reel/…", ["Watch this Instagram reel"], ["Open the reel", "Watch at least 5 seconds", "Screenshot", "Submit proof"], "Watch the required duration before submitting."),
  ],
  youtube: [
    S("yt_subs", "subscribe", "YouTube Subscribers", "Real subscribers on your YouTube channel", 0.15, "subscribers", 50, 10000, [50, 100, 250, 500, 1000], "~72h", "https://www.youtube.com/@yourchannel", ["Subscribe to this YouTube channel"], ["Open the channel", "Tap Subscribe", "Screenshot", "Submit proof"], "Do not unsubscribe after proof."),
    S("yt_views", "view", "YouTube Views", "Real views on your YouTube video", 0.02, "views", 100, 100000, [100, 500, 1000, 5000, 10000], "~48h", "https://www.youtube.com/watch?v=…", ["Watch this YouTube video"], ["Open the video", "Watch the required time", "Screenshot", "Submit proof"], "Watch genuinely."),
    S("yt_likes", "like", "YouTube Likes", "Real likes on your YouTube video", 0.05, "likes", 50, 50000, [50, 100, 250, 500, 1000], "~48h", "https://www.youtube.com/watch?v=…", ["Like this YouTube video"], ["Open the video", "Tap Like", "Screenshot", "Submit proof"], "Do not remove the like after submitting."),
  ],
  tiktok: [
    S("tt_followers", "follow", "TikTok Followers", "Real followers on your TikTok account", 0.08, "followers", 50, 10000, [50, 100, 250, 500, 1000, 5000], "~48h", "https://www.tiktok.com/@yourusername", ["Follow this TikTok account"], ["Open the TikTok profile", "Tap Follow", "Screenshot", "Submit proof"], "Do not unfollow after proof."),
    S("tt_likes", "like", "TikTok Likes", "Real likes on your TikTok video", 0.02, "likes", 50, 50000, [50, 100, 250, 500, 1000, 5000], "~24h", "https://www.tiktok.com/@user/video/…", ["Like this TikTok video"], ["Open the video", "Tap Like", "Screenshot", "Submit proof"], "Do not unlike after proof."),
    S("tt_views", "view", "TikTok Views", "Real views on your TikTok video", 0.01, "views", 100, 100000, [100, 500, 1000, 5000, 10000], "~24h", "https://www.tiktok.com/@user/video/…", ["Watch this TikTok video"], ["Open the video", "Watch fully", "Screenshot", "Submit proof"], "Watch before submitting."),
  ],
  x: [
    S("x_followers", "follow", "X Followers", "Real followers on your X account", 0.1, "followers", 50, 10000, [50, 100, 250, 500, 1000], "~48h", "https://x.com/yourusername", ["Follow this X account"], ["Open the X profile", "Tap Follow", "Screenshot", "Submit proof"], "X only. Do not unfollow after proof."),
    S("x_likes", "like", "X Likes", "Real likes on your X post", 0.03, "likes", 50, 50000, [50, 100, 250, 500, 1000], "~24h", "https://x.com/user/status/…", ["Like this post on X"], ["Open the post", "Tap Like", "Screenshot", "Submit proof"], "Complete only on X."),
    S("x_reposts", "repost", "X Reposts", "Real reposts on your X post", 0.08, "reposts", 50, 50000, [50, 100, 250, 500, 1000], "~24h", "https://x.com/user/status/…", ["Repost this on X"], ["Open the post", "Tap Repost", "Screenshot", "Submit proof"], "Do not undo the repost after submitting."),
  ],
  facebook: [
    S("fb_page", "like", "Facebook Page Likes", "Real likes on your Facebook page", 0.08, "likes", 50, 10000, [50, 100, 250, 500, 1000], "~48h", "https://www.facebook.com/yourpage", ["Like this Facebook page"], ["Open the page", "Tap Like / Follow", "Screenshot", "Submit proof"], "Facebook only."),
    S("fb_post", "like", "Facebook Post Likes", "Real likes on your Facebook post", 0.03, "likes", 50, 50000, [50, 100, 250, 500, 1000], "~24h", "https://www.facebook.com/…/posts/…", ["Like this Facebook post"], ["Open the post", "Tap Like", "Screenshot", "Submit proof"], "Complete on Facebook only."),
  ],
  linkedin: [
    S("li_followers", "follow", "LinkedIn Followers", "Real followers on your LinkedIn profile or page", 0.15, "followers", 50, 10000, [50, 100, 250, 500, 1000], "~72h", "https://www.linkedin.com/in/…", ["Follow this LinkedIn profile"], ["Open LinkedIn profile", "Tap Follow", "Screenshot", "Submit proof"], "LinkedIn only."),
    S("li_likes", "like", "LinkedIn Post Likes", "Real likes on your LinkedIn post", 0.08, "likes", 50, 10000, [50, 100, 250, 500, 1000], "~48h", "https://www.linkedin.com/posts/…", ["Like this LinkedIn post"], ["Open the post", "Tap Like", "Screenshot", "Submit proof"], "Complete on LinkedIn only."),
  ],
  threads: [
    S("th_followers", "follow", "Threads Followers", "Real followers on your Threads account", 0.08, "followers", 50, 10000, [50, 100, 250, 500, 1000], "~48h", "https://www.threads.net/@username", ["Follow this Threads account"], ["Open Threads profile", "Tap Follow", "Screenshot", "Submit proof"], "Threads only."),
    S("th_likes", "like", "Threads Likes", "Real likes on your Threads post", 0.03, "likes", 50, 50000, [50, 100, 250, 500, 1000], "~24h", "https://www.threads.net/@user/post/…", ["Like this Threads post"], ["Open the post", "Tap Like", "Screenshot", "Submit proof"], "Complete on Threads only."),
  ],
  telegram: [
    S("tg_members", "join", "Telegram Channel Members", "Real members for your Telegram channel", 0.06, "members", 50, 10000, [50, 100, 250, 500, 1000, 5000], "~48h", "https://t.me/yourchannel", ["Join this Telegram channel"], ["Open the invite link", "Join the channel", "Stay joined", "Submit proof if required"], "Do not leave immediately after joining."),
    S("tg_group", "join", "Telegram Group Members", "Real members for your Telegram group", 0.055, "members", 50, 10000, [50, 100, 250, 500, 1000], "~48h", "https://t.me/yourgroup", ["Join this Telegram group"], ["Open the invite link", "Join the group", "Stay joined", "Submit proof if required"], "Do not leave right after joining."),
  ],
  whatsapp: [
    S("wa_channel", "join", "WhatsApp Channel Growth", "Real followers for your WhatsApp channel", 0.07, "members", 50, 5000, [50, 100, 250, 500, 1000], "~72h", "https://whatsapp.com/channel/…", ["Follow this WhatsApp channel"], ["Open the channel link", "Follow the channel", "Screenshot", "Submit proof"], "WhatsApp only."),
    S("wa_group", "join", "WhatsApp Group Members", "Real members for your WhatsApp group", 0.065, "members", 50, 5000, [50, 100, 250, 500, 1000], "~72h", "https://chat.whatsapp.com/…", ["Join this WhatsApp group"], ["Open the invite", "Join the group", "Stay joined", "Submit proof"], "Do not leave immediately after joining."),
  ],
  discord: [
    S("dc_members", "join", "Discord Server Members", "Real members for your Discord server", 0.07, "members", 50, 10000, [50, 100, 250, 500, 1000], "~48h", "https://discord.gg/…", ["Join this Discord server"], ["Open the invite", "Join the server", "Stay joined", "Submit proof"], "Discord only."),
  ],
  spotify: [
    S("sp_plays", "view", "Spotify Plays", "Real plays on your Spotify track", 0.02, "plays", 100, 100000, [100, 500, 1000, 5000], "~48h", "https://open.spotify.com/track/…", ["Play this Spotify track"], ["Open the track on Spotify", "Play fully", "Screenshot", "Submit proof"], "Spotify only."),
    S("sp_followers", "follow", "Spotify Followers", "Real followers on your Spotify profile", 0.07, "followers", 50, 10000, [50, 100, 250, 500, 1000], "~72h", "https://open.spotify.com/artist/…", ["Follow this Spotify artist"], ["Open the profile", "Tap Follow", "Screenshot", "Submit proof"], "Do not unfollow after proof."),
  ],
  soundcloud: [
    S("sc_plays", "view", "SoundCloud Plays", "Real plays on your SoundCloud track", 0.02, "plays", 100, 100000, [100, 500, 1000, 5000], "~48h", "https://soundcloud.com/…", ["Play this SoundCloud track"], ["Open the track", "Play fully", "Screenshot", "Submit proof"], "SoundCloud only."),
    S("sc_followers", "follow", "SoundCloud Followers", "Real followers on your SoundCloud", 0.06, "followers", 50, 10000, [50, 100, 250, 500, 1000], "~72h", "https://soundcloud.com/yourname", ["Follow this SoundCloud profile"], ["Open the profile", "Tap Follow", "Screenshot", "Submit proof"], "Do not unfollow after proof."),
  ],
  audiomack: [
    S("am_plays", "view", "Audiomack Plays", "Real plays on your Audiomack track", 0.02, "plays", 100, 100000, [100, 500, 1000, 5000], "~48h", "https://audiomack.com/…", ["Play this Audiomack track"], ["Open the track", "Play fully", "Screenshot", "Submit proof"], "Audiomack only."),
    S("am_followers", "follow", "Audiomack Followers", "Real followers on Audiomack", 0.055, "followers", 50, 10000, [50, 100, 250, 500, 1000], "~72h", "https://audiomack.com/yourname", ["Follow this Audiomack artist"], ["Open the profile", "Tap Follow", "Screenshot", "Submit proof"], "Do not unfollow after proof."),
  ],
  app_review: [
    S("ar_ios", "review", "iOS App Reviews", "Real reviews on the App Store", 1.5, "reviews", 5, 500, [5, 10, 25, 50, 100], "~96h", "https://apps.apple.com/app/…", ["Review this iOS app"], ["Open the App Store page", "Leave an honest review", "Screenshot", "Submit proof"], "Honest reviews only."),
    S("ar_android", "review", "Android App Reviews", "Real reviews on Google Play", 1.4, "reviews", 5, 500, [5, 10, 25, 50, 100], "~96h", "https://play.google.com/store/apps/…", ["Review this Android app"], ["Open Play Store", "Leave an honest review", "Screenshot", "Submit proof"], "Honest reviews only."),
  ],
  google: [
    S("gb_reviews", "review", "Google Business Reviews", "Real Google Business reviews", 1.2, "reviews", 5, 200, [5, 10, 25, 50], "~96h", "https://maps.google.com/…", ["Review this Google Business"], ["Open the listing", "Leave an honest review", "Screenshot", "Submit proof"], "Honest local reviews only."),
  ],
  website: [
    S("web_traffic", "view", "Website Traffic", "Real visitors to your website", 0.02, "visits", 100, 100000, [100, 500, 1000, 5000], "~48h", "https://yoursite.com", ["Visit this website"], ["Open the URL", "Browse for 30+ seconds", "Screenshot", "Submit proof"], "Stay on page for the required time."),
    S("web_signups", "join", "Website Sign-ups", "Real user registrations", 0.25, "sign-ups", 10, 5000, [10, 25, 50, 100, 250], "~72h", "https://yoursite.com/signup", ["Sign up on this website"], ["Open the signup page", "Create an account", "Screenshot confirmation", "Submit proof"], "Real emails only."),
  ],
  survey: [
    S("sv_responses", "join", "Survey Responses", "Real people to complete your survey", 0.3, "responses", 10, 5000, [10, 25, 50, 100, 250], "~72h", "https://forms.google.com/…", ["Complete this survey"], ["Open the survey", "Answer honestly", "Screenshot completion", "Submit proof"], "Honest answers only."),
  ],
  pinterest: [
    S("pin_followers", "follow", "Pinterest Followers", "Real followers on your Pinterest", 0.08, "followers", 50, 10000, [50, 100, 250, 500, 1000], "~72h", "https://www.pinterest.com/yourname", ["Follow this Pinterest account"], ["Open the profile", "Tap Follow", "Screenshot", "Submit proof"], "Pinterest only."),
    S("pin_saves", "like", "Pinterest Saves", "Real saves on your Pinterest pin", 0.04, "saves", 50, 50000, [50, 100, 250, 500, 1000], "~48h", "https://www.pinterest.com/pin/…", ["Save this Pinterest pin"], ["Open the pin", "Tap Save", "Screenshot", "Submit proof"], "Pinterest only."),
  ],
  reddit: [
    S("rd_upvotes", "like", "Reddit Upvotes", "Real upvotes on your Reddit post", 0.04, "upvotes", 50, 10000, [50, 100, 250, 500, 1000], "~48h", "https://www.reddit.com/r/…/comments/…", ["Upvote this Reddit post"], ["Open the post", "Upvote", "Screenshot", "Submit proof"], "Reddit account required."),
    S("rd_comments", "comment", "Reddit Comments", "Real comments on your Reddit post", 0.15, "comments", 10, 2000, [10, 25, 50, 100], "~72h", "https://www.reddit.com/r/…/comments/…", ["Comment on this Reddit post"], ["Open the post", "Leave a relevant comment", "Screenshot", "Submit proof"], "Subreddit rules apply."),
  ],
  twitch: [
    S("tw_followers", "follow", "Twitch Followers", "Real followers on your Twitch channel", 0.08, "followers", 50, 10000, [50, 100, 250, 500, 1000], "~48h", "https://www.twitch.tv/yourname", ["Follow this Twitch channel"], ["Open the channel", "Tap Follow", "Screenshot", "Submit proof"], "Twitch only."),
    S("tw_views", "view", "Twitch Views", "Real views on your Twitch stream/VOD", 0.03, "views", 100, 50000, [100, 500, 1000, 5000], "~48h", "https://www.twitch.tv/videos/…", ["Watch this Twitch VOD"], ["Open the stream or VOD", "Watch for required time", "Screenshot", "Submit proof"], "Watch genuinely."),
  ],
};

export const QTY_UNIT_LABEL: Record<string, string> = {
  followers: "followers",
  likes: "likes",
  comments: "comments",
  views: "views",
  members: "members",
  subscribers: "subscribers",
  reposts: "reposts",
  plays: "plays",
  saves: "saves",
  reviews: "reviews",
  ratings: "ratings",
  visits: "visits",
  "sign-ups": "sign-ups",
  clicks: "clicks",
  responses: "responses",
  votes: "votes",
  upvotes: "upvotes",
  messages: "messages",
  actions: "actions",
  playlists: "playlists",
  package: "package",
};
