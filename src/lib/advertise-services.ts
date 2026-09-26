/** TASKORA Advertise catalogue — approved economy pricing (USD).
 * Customer price = tasker reward + TASKORA margin (default 70/30).
 * Owner can override rates; users can set custom price per campaign.
 */
import type { Platform } from "@/components/PlatformIcon";

export type ServiceDef = {
  id: string;
  taskType: string;
  title: string;
  desc: string;
  fromUsd: number;
  taskerUsd: number;
  taskoraUsd: number;
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

export const TASKORA_SHARE = 0.3;
export const TASKER_SHARE = 0.7;
export const PLATFORM_FEE = TASKORA_SHARE;
export const FEATURE_FEE_USD = 5;

function S(
  id: string,
  taskType: string,
  title: string,
  desc: string,
  fromUsd: number,
  taskerUsd: number,
  taskoraUsd: number,
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
    taskerUsd,
    taskoraUsd,
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
    S("ig_followers", "follow", "Instagram Followers", "Real followers on your Instagram account", 0.02, 0.014, 0.006, "followers", 100, 10000, [100, 250, 500, 1000, 2500, 5000], "~48h", "https://www.instagram.com/yourusername", ["Follow this Instagram account"], ["Open the Instagram profile", "Tap Follow", "Screenshot the followed profile", "Submit proof"], "Real engagement only. Do not unfollow after proof."),
    S("ig_likes", "like", "Instagram Likes", "Real likes on your Instagram post", 0.012, 0.0084, 0.0036, "likes", 100, 50000, [100, 250, 500, 1000, 5000], "~24h", "https://www.instagram.com/p/…", ["Like this Instagram post"], ["Open the post", "Like the post", "Screenshot", "Submit proof"], "Do not unlike after submitting."),
    S("ig_comments", "comment", "Instagram Comments", "Real comments on your Instagram post", 0.025, 0.0175, 0.0075, "comments", 50, 5000, [20, 50, 100, 250], "~48h", "https://www.instagram.com/p/…", ["Comment on this Instagram post"], ["Open the post", "Write a relevant comment", "Screenshot", "Submit proof"], "Spam or emoji-only comments may be rejected."),
    S("ig_views", "view", "Instagram Video Views", "Real views on your Instagram reel or video", 0.0025, 0.00175, 0.00075, "views", 1000, 100000, [500, 1000, 5000, 10000], "~24h", "https://www.instagram.com/reel/…", ["Watch this Instagram reel"], ["Open the reel", "Watch at least 5 seconds", "Screenshot", "Submit proof"], "Watch the required duration before submitting."),
  ],
  youtube: [
    S("yt_subs", "subscribe", "YouTube Subscribers", "Real subscribers on your YouTube channel", 0.03, 0.021, 0.009, "subscribers", 50, 10000, [100, 250, 500, 1000], "~72h", "https://www.youtube.com/@yourchannel", ["Subscribe to this YouTube channel"], ["Open the channel", "Tap Subscribe", "Screenshot", "Submit proof"], "Do not unsubscribe after proof."),
    S("yt_likes", "like", "YouTube Likes", "Real likes on your YouTube video", 0.015, 0.0105, 0.0045, "likes", 100, 50000, [100, 250, 500, 1000], "~48h", "https://www.youtube.com/watch?v=…", ["Like this YouTube video"], ["Open the video", "Tap Like", "Screenshot", "Submit proof"], "Do not remove the like after submitting."),
    S("yt_comments", "comment", "YouTube Comments", "Real comments on your YouTube video", 0.03, 0.021, 0.009, "comments", 50, 5000, [20, 50, 100, 250], "~72h", "https://www.youtube.com/watch?v=…", ["Comment on this YouTube video"], ["Open the video", "Post a relevant comment", "Screenshot", "Submit proof"], "Spam comments will be rejected."),
    S("yt_watch", "watch", "YouTube Watch", "Watch video and earn from verified watch time", 0.0003, 0.00021, 0.00009, "seconds", 10, 10800, [30, 60, 120, 300, 600, 1800, 3600, 7200, 10800], "~24h", "Video URL or upload", ["Watch the video for the required time"], ["Watch for the required duration", "Wait for automatic verification"], "Watch time is verified automatically."),
  ],
  tiktok: [
    S("tt_followers", "follow", "TikTok Followers", "Real followers on your TikTok account", 0.018, 0.0126, 0.0054, "followers", 100, 10000, [100, 250, 500, 1000, 5000], "~48h", "https://www.tiktok.com/@yourusername", ["Follow this TikTok account"], ["Open the TikTok profile", "Tap Follow", "Screenshot", "Submit proof"], "Do not unfollow after proof."),
    S("tt_likes", "like", "TikTok Likes", "Real likes on your TikTok video", 0.01, 0.007, 0.003, "likes", 100, 50000, [100, 250, 500, 1000, 5000], "~24h", "https://www.tiktok.com/@user/video/…", ["Like this TikTok video"], ["Open the video", "Tap Like", "Screenshot", "Submit proof"], "Do not unlike after proof."),
    S("tt_views", "view", "TikTok Views", "Real views on your TikTok video", 0.002, 0.0014, 0.0006, "views", 1000, 100000, [500, 1000, 5000, 10000], "~24h", "https://www.tiktok.com/@user/video/…", ["Watch this TikTok video"], ["Open the video", "Watch fully", "Screenshot", "Submit proof"], "Watch before submitting."),
    S("tt_comments", "comment", "TikTok Comments", "Real comments on your TikTok video", 0.025, 0.0175, 0.0075, "comments", 50, 5000, [20, 50, 100, 250], "~48h", "https://www.tiktok.com/@user/video/…", ["Comment on this TikTok video"], ["Open the video", "Leave a relevant comment", "Screenshot", "Submit proof"], "Relevant comments only."),
  ],
  x: [
    S("x_followers", "follow", "X Followers", "Real followers on your X account", 0.02, 0.014, 0.006, "followers", 100, 10000, [100, 250, 500, 1000], "~48h", "https://x.com/yourusername", ["Follow this X account"], ["Open the X profile", "Tap Follow", "Screenshot", "Submit proof"], "X only."),
    S("x_likes", "like", "X Likes", "Real likes on your X post", 0.012, 0.0084, 0.0036, "likes", 100, 50000, [100, 250, 500, 1000], "~24h", "https://x.com/user/status/…", ["Like this post on X"], ["Open the post", "Tap Like", "Screenshot", "Submit proof"], "Complete only on X."),
    S("x_reposts", "repost", "X Reposts", "Real reposts on your X post", 0.015, 0.0105, 0.0045, "reposts", 100, 50000, [100, 250, 500, 1000], "~24h", "https://x.com/user/status/…", ["Repost this on X"], ["Open the post", "Tap Repost", "Screenshot", "Submit proof"], "Do not undo after proof."),
    S("x_comments", "comment", "X Comments", "Real comments on your X post", 0.025, 0.0175, 0.0075, "comments", 50, 5000, [20, 50, 100, 250], "~48h", "https://x.com/user/status/…", ["Reply to this post on X"], ["Open the post", "Reply with a relevant comment", "Screenshot", "Submit proof"], "Spam replies will be rejected."),
  ],
  facebook: [
    S("fb_page", "like", "Facebook Page Likes", "Real likes on your Facebook page", 0.015, 0.0105, 0.0045, "likes", 100, 10000, [100, 250, 500, 1000], "~48h", "https://www.facebook.com/yourpage", ["Like this Facebook page"], ["Open the page", "Tap Like / Follow", "Screenshot", "Submit proof"], "Facebook only."),
    S("fb_post", "like", "Facebook Post Likes", "Real likes on your Facebook post", 0.012, 0.0084, 0.0036, "likes", 100, 50000, [100, 250, 500, 1000], "~24h", "https://www.facebook.com/…/posts/…", ["Like this Facebook post"], ["Open the post", "Tap Like", "Screenshot", "Submit proof"], "Complete on Facebook only."),
    S("fb_followers", "follow", "Facebook Followers", "Real followers on your Facebook profile", 0.02, 0.014, 0.006, "followers", 100, 10000, [100, 250, 500, 1000], "~48h", "https://www.facebook.com/yourprofile", ["Follow this Facebook profile"], ["Open the profile", "Tap Follow", "Screenshot", "Submit proof"], "Do not unfollow after proof."),
    S("fb_comments", "comment", "Facebook Comments", "Real comments on your Facebook post", 0.025, 0.0175, 0.0075, "comments", 50, 5000, [20, 50, 100, 250], "~48h", "https://www.facebook.com/…/posts/…", ["Comment on this Facebook post"], ["Open the post", "Leave a relevant comment", "Screenshot", "Submit proof"], "Relevant comments only."),
  ],
  linkedin: [
    S("li_followers", "follow", "LinkedIn Followers", "Real followers on your LinkedIn", 0.03, 0.021, 0.009, "followers", 100, 10000, [100, 250, 500, 1000], "~72h", "https://www.linkedin.com/in/…", ["Follow this LinkedIn profile"], ["Open LinkedIn profile", "Tap Follow", "Screenshot", "Submit proof"], "LinkedIn only."),
    S("li_likes", "like", "LinkedIn Post Likes", "Real likes on your LinkedIn post", 0.018, 0.0126, 0.0054, "likes", 100, 10000, [100, 250, 500, 1000], "~48h", "https://www.linkedin.com/posts/…", ["Like this LinkedIn post"], ["Open the post", "Tap Like", "Screenshot", "Submit proof"], "Complete on LinkedIn only."),
    S("li_comments", "comment", "LinkedIn Comments", "Real comments on your LinkedIn post", 0.03, 0.021, 0.009, "comments", 50, 2000, [20, 50, 100], "~72h", "https://www.linkedin.com/posts/…", ["Comment on this LinkedIn post"], ["Open the post", "Write a professional comment", "Screenshot", "Submit proof"], "Professional comments only."),
  ],
  threads: [
    S("th_followers", "follow", "Threads Followers", "Real followers on Threads", 0.02, 0.014, 0.006, "followers", 100, 10000, [100, 250, 500, 1000], "~48h", "https://www.threads.net/@username", ["Follow this Threads account"], ["Open Threads profile", "Tap Follow", "Screenshot", "Submit proof"], "Threads only."),
    S("th_likes", "like", "Threads Likes", "Real likes on your Threads post", 0.012, 0.0084, 0.0036, "likes", 100, 50000, [100, 250, 500, 1000], "~24h", "https://www.threads.net/@user/post/…", ["Like this Threads post"], ["Open the post", "Tap Like", "Screenshot", "Submit proof"], "Complete on Threads only."),
    S("th_reposts", "repost", "Threads Reposts", "Real reposts on Threads", 0.015, 0.0105, 0.0045, "reposts", 100, 20000, [100, 250, 500, 1000], "~48h", "https://www.threads.net/@user/post/…", ["Repost this on Threads"], ["Open the post", "Repost", "Screenshot", "Submit proof"], "Do not undo after proof."),
  ],
  telegram: [
    S("tg_members", "join", "Telegram Channel Members", "Real members for your Telegram channel", 0.025, 0.0175, 0.0075, "members", 100, 10000, [100, 250, 500, 1000, 5000], "~48h", "https://t.me/yourchannel", ["Join this Telegram channel"], ["Open the invite link", "Join the channel", "Stay joined", "Submit proof if required"], "Do not leave immediately after joining."),
    S("tg_group", "join", "Telegram Group Members", "Real members for your Telegram group", 0.025, 0.0175, 0.0075, "members", 100, 10000, [100, 250, 500, 1000], "~48h", "https://t.me/yourgroup", ["Join this Telegram group"], ["Open the invite link", "Join the group", "Stay joined", "Submit proof if required"], "Do not leave right after joining."),
  ],
  whatsapp: [
    S("wa_channel", "join", "WhatsApp Channel Growth", "Real followers for your WhatsApp channel", 0.03, 0.021, 0.009, "members", 100, 5000, [100, 250, 500, 1000], "~72h", "https://whatsapp.com/channel/…", ["Follow this WhatsApp channel"], ["Open the channel link", "Follow the channel", "Screenshot", "Submit proof"], "WhatsApp only."),
    S("wa_group", "join", "WhatsApp Group Members", "Real members for your WhatsApp group", 0.03, 0.021, 0.009, "members", 100, 5000, [100, 250, 500, 1000], "~72h", "https://chat.whatsapp.com/…", ["Join this WhatsApp group"], ["Open the invite", "Join the group", "Stay joined", "Submit proof"], "Do not leave immediately after joining."),
  ],
  discord: [
    S("dc_members", "join", "Discord Server Members", "Real members for your Discord server", 0.025, 0.0175, 0.0075, "members", 100, 10000, [100, 250, 500, 1000], "~48h", "https://discord.gg/…", ["Join this Discord server"], ["Open the invite", "Join the server", "Stay joined", "Submit proof"], "Discord only."),
    S("dc_boost", "join", "Discord Engagement", "Active engagement in your server", 0.025, 0.0175, 0.0075, "actions", 20, 5000, [20, 50, 100, 250], "~48h", "https://discord.gg/…", ["Engage in this Discord server"], ["Join the server", "Send a relevant message", "Screenshot", "Submit proof"], "Spam messages will be rejected."),
  ],
  spotify: [
    S("sp_plays", "view", "Spotify Plays", "Real plays on your Spotify track", 0.002, 0.0014, 0.0006, "plays", 1000, 100000, [500, 1000, 5000], "~48h", "https://open.spotify.com/track/…", ["Play this Spotify track"], ["Open the track on Spotify", "Play fully", "Screenshot", "Submit proof"], "Spotify only."),
    S("sp_followers", "follow", "Spotify Followers", "Real followers on your Spotify profile", 0.03, 0.021, 0.009, "followers", 100, 10000, [100, 250, 500, 1000], "~72h", "https://open.spotify.com/artist/…", ["Follow this Spotify artist"], ["Open the profile", "Tap Follow", "Screenshot", "Submit proof"], "Do not unfollow after proof."),
    S("sp_playlist", "follow", "Playlist Promotion", "Add your track to curated playlists", 1.0, 0.7, 0.3, "playlists", 1, 50, [1, 5, 10, 25], "~96h", "https://open.spotify.com/track/…", ["Add this track to a playlist"], ["Open the track", "Add to a public playlist", "Screenshot", "Submit proof"], "Public playlists only."),
    S("sp_saves", "like", "Spotify Saves", "Real saves on your Spotify track", 0.02, 0.014, 0.006, "saves", 100, 20000, [100, 250, 500, 1000], "~48h", "https://open.spotify.com/track/…", ["Save this Spotify track"], ["Open the track", "Tap Save / Heart", "Screenshot", "Submit proof"], "Do not unsave after proof."),
  ],
  soundcloud: [
    S("sc_plays", "view", "SoundCloud Plays", "Real plays on your SoundCloud track", 0.002, 0.0014, 0.0006, "plays", 1000, 100000, [500, 1000, 5000], "~48h", "https://soundcloud.com/…", ["Play this SoundCloud track"], ["Open the track", "Play fully", "Screenshot", "Submit proof"], "SoundCloud only."),
    S("sc_followers", "follow", "SoundCloud Followers", "Real followers on SoundCloud", 0.025, 0.0175, 0.0075, "followers", 100, 10000, [100, 250, 500, 1000], "~72h", "https://soundcloud.com/yourname", ["Follow this SoundCloud profile"], ["Open the profile", "Tap Follow", "Screenshot", "Submit proof"], "Do not unfollow after proof."),
    S("sc_likes", "like", "SoundCloud Likes", "Real likes on your track", 0.012, 0.0084, 0.0036, "likes", 100, 50000, [100, 250, 500, 1000], "~48h", "https://soundcloud.com/…", ["Like this SoundCloud track"], ["Open the track", "Tap Like", "Screenshot", "Submit proof"], "SoundCloud only."),
  ],
  audiomack: [
    S("am_plays", "view", "Audiomack Plays", "Real plays on Audiomack", 0.0015, 0.00105, 0.00045, "plays", 1000, 100000, [500, 1000, 5000], "~48h", "https://audiomack.com/…", ["Play this Audiomack track"], ["Open the track", "Play fully", "Screenshot", "Submit proof"], "Audiomack only."),
    S("am_followers", "follow", "Audiomack Followers", "Real followers on Audiomack", 0.02, 0.014, 0.006, "followers", 100, 10000, [100, 250, 500, 1000], "~72h", "https://audiomack.com/yourname", ["Follow this Audiomack artist"], ["Open the profile", "Tap Follow", "Screenshot", "Submit proof"], "Do not unfollow after proof."),
    S("am_likes", "like", "Audiomack Likes", "Real likes on your track", 0.012, 0.0084, 0.0036, "likes", 100, 50000, [100, 250, 500, 1000], "~48h", "https://audiomack.com/…", ["Like this Audiomack track"], ["Open the track", "Tap Like", "Screenshot", "Submit proof"], "Audiomack only."),
  ],
  app_review: [
    S("ar_ios", "review", "iOS App Reviews", "Real reviews on the App Store", 1.5, 1.05, 0.45, "reviews", 20, 500, [10, 25, 50, 100], "~96h", "https://apps.apple.com/app/…", ["Review this iOS app"], ["Open the App Store page", "Leave an honest review", "Screenshot", "Submit proof"], "Honest reviews only."),
    S("ar_android", "review", "Android App Reviews", "Real reviews on Google Play", 1.5, 1.05, 0.45, "reviews", 20, 500, [10, 25, 50, 100], "~96h", "https://play.google.com/store/apps/…", ["Review this Android app"], ["Open Play Store", "Leave an honest review", "Screenshot", "Submit proof"], "Honest reviews only."),
    S("ar_ratings", "review", "App Ratings", "Star ratings for your mobile app", 0.5, 0.35, 0.15, "ratings", 50, 1000, [20, 50, 100, 250], "~72h", "App Store or Play Store URL", ["Rate this app"], ["Open the store page", "Submit a rating", "Screenshot", "Submit proof"], "Genuine ratings only."),
  ],
  google: [
    S("gb_reviews", "review", "Google Business Reviews", "Real Google Business reviews", 0.25, 0.175, 0.075, "reviews", 20, 200, [10, 25, 50], "~96h", "https://maps.google.com/…", ["Review this Google Business"], ["Open the listing", "Leave an honest review", "Screenshot", "Submit proof"], "Honest local reviews only."),
    S("gb_seo", "view", "Local SEO Boost", "Visibility boost for your Google listing", 1.5, 1.05, 0.45, "package", 5, 1, [1], "~7d", "Google Business URL", ["Boost this Google listing"], ["Open the listing", "Engage as instructed", "Screenshot", "Submit proof"], "Follow instructions carefully."),
  ],
  website: [
    S("web_traffic", "view", "Website Traffic", "Real visitors to your website", 0.003, 0.0021, 0.0009, "visits", 1000, 100000, [500, 1000, 5000], "~48h", "https://yoursite.com", ["Visit this website"], ["Open the URL", "Browse for 30+ seconds", "Screenshot", "Submit proof"], "Stay on page for the required time."),
    S("web_signups", "join", "Website Sign-ups", "Real user registrations", 0.04, 0.028, 0.012, "sign-ups", 50, 5000, [20, 50, 100, 250], "~72h", "https://yoursite.com/signup", ["Sign up on this website"], ["Open the signup page", "Create an account", "Screenshot confirmation", "Submit proof"], "Real emails only."),
    S("web_clicks", "view", "Link Clicks", "Real clicks on your link or ad", 0.008, 0.0056, 0.0024, "clicks", 100, 50000, [100, 250, 500, 1000], "~24h", "https://yourlink.com", ["Click this link"], ["Open the link", "Wait for page load", "Screenshot", "Submit proof"], "Valid clicks only."),
  ],
  survey: [
    S("sv_responses", "join", "Survey Responses", "Real survey completions", 0.5, 0.35, 0.15, "responses", 50, 5000, [20, 50, 100, 250], "~72h", "https://forms.google.com/…", ["Complete this survey"], ["Open the survey", "Answer honestly", "Screenshot completion", "Submit proof"], "Honest answers only."),
    S("sv_votes", "like", "Poll Votes", "Real votes on your online poll", 0.25, 0.175, 0.075, "votes", 50, 50000, [20, 50, 100, 250, 500], "~24h", "Poll / contest URL", ["Vote on this poll"], ["Open the poll", "Cast your vote", "Screenshot", "Submit proof"], "One vote per person unless stated."),
  ],
  pinterest: [
    S("pin_followers", "follow", "Pinterest Followers", "Real followers on Pinterest", 0.02, 0.014, 0.006, "followers", 100, 10000, [100, 250, 500, 1000], "~72h", "https://www.pinterest.com/yourname", ["Follow this Pinterest account"], ["Open the profile", "Tap Follow", "Screenshot", "Submit proof"], "Pinterest only."),
    S("pin_saves", "like", "Pinterest Saves", "Real saves on your pin", 0.015, 0.0105, 0.0045, "saves", 100, 50000, [100, 250, 500, 1000], "~48h", "https://www.pinterest.com/pin/…", ["Save this Pinterest pin"], ["Open the pin", "Tap Save", "Screenshot", "Submit proof"], "Pinterest only."),
  ],
  reddit: [
    S("rd_upvotes", "like", "Reddit Upvotes", "Real upvotes on your Reddit post", 0.15, 0.105, 0.045, "upvotes", 100, 10000, [100, 250, 500, 1000], "~48h", "https://www.reddit.com/r/…/comments/…", ["Upvote this Reddit post"], ["Open the post", "Upvote", "Screenshot", "Submit proof"], "Reddit account required."),
    S("rd_comments", "comment", "Reddit Comments", "Real comments on your Reddit post", 0.3, 0.21, 0.09, "comments", 20, 2000, [20, 50, 100], "~72h", "https://www.reddit.com/r/…/comments/…", ["Comment on this Reddit post"], ["Open the post", "Leave a relevant comment", "Screenshot", "Submit proof"], "Subreddit rules apply."),
  ],
  twitch: [
    S("tw_followers", "follow", "Twitch Followers", "Real followers on Twitch", 0.025, 0.0175, 0.0075, "followers", 100, 10000, [100, 250, 500, 1000], "~48h", "https://www.twitch.tv/yourname", ["Follow this Twitch channel"], ["Open the channel", "Tap Follow", "Screenshot", "Submit proof"], "Twitch only."),
    S("tw_views", "view", "Twitch Views", "Real views on Twitch stream/VOD", 0.003, 0.0021, 0.0009, "views", 1000, 50000, [500, 1000, 5000], "~48h", "https://www.twitch.tv/videos/…", ["Watch this Twitch VOD"], ["Open the stream or VOD", "Watch for required time", "Screenshot", "Submit proof"], "Watch genuinely."),
    S("tw_chat", "comment", "Twitch Chat Engagement", "Active chat during your stream", 0.025, 0.0175, 0.0075, "messages", 50, 5000, [20, 50, 100, 250], "~24h", "https://www.twitch.tv/yourname", ["Chat on this Twitch stream"], ["Join the live stream", "Send a relevant chat message", "Screenshot", "Submit proof"], "Spam chat will be rejected."),
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
  seconds: "seconds",
};

export function campaignTotals(customerPerUnit: number, qty: number) {
  const customer = Math.max(0, customerPerUnit) * Math.max(0, qty);
  const tasker = customer * TASKER_SHARE;
  const taskora = customer * TASKORA_SHARE;
  return { customer, tasker, taskora };
}
