export type AdvertiseService = {
  serviceId: string;
  platform: string;
  serviceName: string;
  taskType: string;
  minQuantity: number;
  maxQuantity: number;
  customerUnitPrice: number;
  taskerUnitReward: number;
  taskoraUnitMargin: number;
  pricingModel: "unit" | "watch_second";
};

export const ADVERTISE_SERVICES: AdvertiseService[] = [
  {serviceId:"ig_followers",platform:"instagram",serviceName:"Instagram Followers",taskType:"follow",minQuantity:100,maxQuantity:10000,customerUnitPrice:.02,taskerUnitReward:.014,taskoraUnitMargin:.006,pricingModel:"unit"},
  {serviceId:"ig_likes",platform:"instagram",serviceName:"Instagram Likes",taskType:"like",minQuantity:100,maxQuantity:50000,customerUnitPrice:.012,taskerUnitReward:.0084,taskoraUnitMargin:.0036,pricingModel:"unit"},
  {serviceId:"ig_comments",platform:"instagram",serviceName:"Instagram Comments",taskType:"comment",minQuantity:20,maxQuantity:5000,customerUnitPrice:.025,taskerUnitReward:.0175,taskoraUnitMargin:.0075,pricingModel:"unit"},
  {serviceId:"ig_views",platform:"instagram",serviceName:"Instagram Video Views",taskType:"view",minQuantity:500,maxQuantity:100000,customerUnitPrice:.0025,taskerUnitReward:.00175,taskoraUnitMargin:.00075,pricingModel:"unit"},
  {serviceId:"yt_subs",platform:"youtube",serviceName:"YouTube Subscribers",taskType:"subscribe",minQuantity:100,maxQuantity:10000,customerUnitPrice:.03,taskerUnitReward:.021,taskoraUnitMargin:.009,pricingModel:"unit"},
  {serviceId:"yt_views",platform:"youtube",serviceName:"YouTube Views",taskType:"view",minQuantity:500,maxQuantity:100000,customerUnitPrice:.003,taskerUnitReward:.0021,taskoraUnitMargin:.0009,pricingModel:"unit"},
  {serviceId:"yt_likes",platform:"youtube",serviceName:"YouTube Likes",taskType:"like",minQuantity:100,maxQuantity:50000,customerUnitPrice:.015,taskerUnitReward:.0105,taskoraUnitMargin:.0045,pricingModel:"unit"},
  {serviceId:"yt_comments",platform:"youtube",serviceName:"YouTube Comments",taskType:"comment",minQuantity:20,maxQuantity:5000,customerUnitPrice:.03,taskerUnitReward:.021,taskoraUnitMargin:.009,pricingModel:"unit"},
  {serviceId:"yt_watch",platform:"youtube",serviceName:"YouTube Watch (per second)",taskType:"watch_second",minQuantity:1,maxQuantity:3600,customerUnitPrice:.0001,taskerUnitReward:.00007,taskoraUnitMargin:.00003,pricingModel:"watch_second"},
  {serviceId:"tt_followers",platform:"tiktok",serviceName:"TikTok Followers",taskType:"follow",minQuantity:100,maxQuantity:10000,customerUnitPrice:.018,taskerUnitReward:.0126,taskoraUnitMargin:.0054,pricingModel:"unit"},
  {serviceId:"tt_likes",platform:"tiktok",serviceName:"TikTok Likes",taskType:"like",minQuantity:100,maxQuantity:50000,customerUnitPrice:.01,taskerUnitReward:.007,taskoraUnitMargin:.003,pricingModel:"unit"},
  {serviceId:"tt_views",platform:"tiktok",serviceName:"TikTok Views",taskType:"view",minQuantity:500,maxQuantity:100000,customerUnitPrice:.002,taskerUnitReward:.0014,taskoraUnitMargin:.0006,pricingModel:"unit"},
  {serviceId:"tt_comments",platform:"tiktok",serviceName:"TikTok Comments",taskType:"comment",minQuantity:20,maxQuantity:5000,customerUnitPrice:.025,taskerUnitReward:.0175,taskoraUnitMargin:.0075,pricingModel:"unit"},
  {serviceId:"x_followers",platform:"x",serviceName:"X Followers",taskType:"follow",minQuantity:100,maxQuantity:10000,customerUnitPrice:.02,taskerUnitReward:.014,taskoraUnitMargin:.006,pricingModel:"unit"},
  {serviceId:"x_likes",platform:"x",serviceName:"X Likes",taskType:"like",minQuantity:100,maxQuantity:50000,customerUnitPrice:.012,taskerUnitReward:.0084,taskoraUnitMargin:.0036,pricingModel:"unit"},
  {serviceId:"x_reposts",platform:"x",serviceName:"X Reposts",taskType:"repost",minQuantity:100,maxQuantity:50000,customerUnitPrice:.015,taskerUnitReward:.0105,taskoraUnitMargin:.0045,pricingModel:"unit"},
  {serviceId:"x_comments",platform:"x",serviceName:"X Comments",taskType:"comment",minQuantity:20,maxQuantity:5000,customerUnitPrice:.025,taskerUnitReward:.0175,taskoraUnitMargin:.0075,pricingModel:"unit"},
  {serviceId:"fb_page",platform:"facebook",serviceName:"Facebook Page Likes",taskType:"like",minQuantity:100,maxQuantity:10000,customerUnitPrice:.015,taskerUnitReward:.0105,taskoraUnitMargin:.0045,pricingModel:"unit"},
  {serviceId:"fb_post",platform:"facebook",serviceName:"Facebook Post Likes",taskType:"like",minQuantity:100,maxQuantity:50000,customerUnitPrice:.012,taskerUnitReward:.0084,taskoraUnitMargin:.0036,pricingModel:"unit"},
  {serviceId:"fb_followers",platform:"facebook",serviceName:"Facebook Followers",taskType:"follow",minQuantity:100,maxQuantity:10000,customerUnitPrice:.02,taskerUnitReward:.014,taskoraUnitMargin:.006,pricingModel:"unit"},
  {serviceId:"fb_comments",platform:"facebook",serviceName:"Facebook Comments",taskType:"comment",minQuantity:20,maxQuantity:5000,customerUnitPrice:.025,taskerUnitReward:.0175,taskoraUnitMargin:.0075,pricingModel:"unit"},
  {serviceId:"li_followers",platform:"linkedin",serviceName:"LinkedIn Followers",taskType:"follow",minQuantity:100,maxQuantity:10000,customerUnitPrice:.03,taskerUnitReward:.021,taskoraUnitMargin:.009,pricingModel:"unit"},
  {serviceId:"li_likes",platform:"linkedin",serviceName:"LinkedIn Likes",taskType:"like",minQuantity:100,maxQuantity:10000,customerUnitPrice:.018,taskerUnitReward:.0126,taskoraUnitMargin:.0054,pricingModel:"unit"},
  {serviceId:"li_comments",platform:"linkedin",serviceName:"LinkedIn Comments",taskType:"comment",minQuantity:20,maxQuantity:2000,customerUnitPrice:.03,taskerUnitReward:.021,taskoraUnitMargin:.009,pricingModel:"unit"},
  {serviceId:"th_followers",platform:"threads",serviceName:"Threads Followers",taskType:"follow",minQuantity:100,maxQuantity:10000,customerUnitPrice:.02,taskerUnitReward:.014,taskoraUnitMargin:.006,pricingModel:"unit"},
  {serviceId:"th_likes",platform:"threads",serviceName:"Threads Likes",taskType:"like",minQuantity:100,maxQuantity:50000,customerUnitPrice:.012,taskerUnitReward:.0084,taskoraUnitMargin:.0036,pricingModel:"unit"},
  {serviceId:"th_reposts",platform:"threads",serviceName:"Threads Reposts",taskType:"repost",minQuantity:100,maxQuantity:20000,customerUnitPrice:.015,taskerUnitReward:.0105,taskoraUnitMargin:.0045,pricingModel:"unit"},
  {serviceId:"tg_members",platform:"telegram",serviceName:"Telegram Channel Members",taskType:"join",minQuantity:100,maxQuantity:10000,customerUnitPrice:.025,taskerUnitReward:.0175,taskoraUnitMargin:.0075,pricingModel:"unit"},
  {serviceId:"tg_group",platform:"telegram",serviceName:"Telegram Group Members",taskType:"join",minQuantity:100,maxQuantity:10000,customerUnitPrice:.025,taskerUnitReward:.0175,taskoraUnitMargin:.0075,pricingModel:"unit"},
  {serviceId:"wa_channel",platform:"whatsapp",serviceName:"WhatsApp Channel Growth",taskType:"join",minQuantity:100,maxQuantity:5000,customerUnitPrice:.03,taskerUnitReward:.021,taskoraUnitMargin:.009,pricingModel:"unit"},
  {serviceId:"wa_group",platform:"whatsapp",serviceName:"WhatsApp Group Growth",taskType:"join",minQuantity:100,maxQuantity:5000,customerUnitPrice:.03,taskerUnitReward:.021,taskoraUnitMargin:.009,pricingModel:"unit"},
  {serviceId:"dc_members",platform:"discord",serviceName:"Discord Members",taskType:"join",minQuantity:100,maxQuantity:10000,customerUnitPrice:.025,taskerUnitReward:.0175,taskoraUnitMargin:.0075,pricingModel:"unit"},
  {serviceId:"dc_boost",platform:"discord",serviceName:"Discord Engagement",taskType:"engage",minQuantity:20,maxQuantity:5000,customerUnitPrice:.025,taskerUnitReward:.0175,taskoraUnitMargin:.0075,pricingModel:"unit"},
  {serviceId:"sp_plays",platform:"spotify",serviceName:"Spotify Plays",taskType:"view",minQuantity:500,maxQuantity:100000,customerUnitPrice:.002,taskerUnitReward:.0014,taskoraUnitMargin:.0006,pricingModel:"unit"},
  {serviceId:"sp_followers",platform:"spotify",serviceName:"Spotify Followers",taskType:"follow",minQuantity:100,maxQuantity:10000,customerUnitPrice:.03,taskerUnitReward:.021,taskoraUnitMargin:.009,pricingModel:"unit"},
  {serviceId:"sp_playlist",platform:"spotify",serviceName:"Spotify Playlist Promotion",taskType:"playlist",minQuantity:1,maxQuantity:50,customerUnitPrice:1,taskerUnitReward:.7,taskoraUnitMargin:.3,pricingModel:"unit"},
  {serviceId:"sp_saves",platform:"spotify",serviceName:"Spotify Saves",taskType:"save",minQuantity:100,maxQuantity:20000,customerUnitPrice:.02,taskerUnitReward:.014,taskoraUnitMargin:.006,pricingModel:"unit"},
  {serviceId:"sc_plays",platform:"soundcloud",serviceName:"SoundCloud Plays",taskType:"view",minQuantity:500,maxQuantity:100000,customerUnitPrice:.002,taskerUnitReward:.0014,taskoraUnitMargin:.0006,pricingModel:"unit"},
  {serviceId:"sc_followers",platform:"soundcloud",serviceName:"SoundCloud Followers",taskType:"follow",minQuantity:100,maxQuantity:10000,customerUnitPrice:.025,taskerUnitReward:.0175,taskoraUnitMargin:.0075,pricingModel:"unit"},
  {serviceId:"sc_likes",platform:"soundcloud",serviceName:"SoundCloud Likes",taskType:"like",minQuantity:100,maxQuantity:50000,customerUnitPrice:.012,taskerUnitReward:.0084,taskoraUnitMargin:.0036,pricingModel:"unit"},
  {serviceId:"am_plays",platform:"audiomack",serviceName:"Audiomack Plays",taskType:"view",minQuantity:500,maxQuantity:100000,customerUnitPrice:.0015,taskerUnitReward:.00105,taskoraUnitMargin:.00045,pricingModel:"unit"},
  {serviceId:"am_followers",platform:"audiomack",serviceName:"Audiomack Followers",taskType:"follow",minQuantity:100,maxQuantity:10000,customerUnitPrice:.02,taskerUnitReward:.014,taskoraUnitMargin:.006,pricingModel:"unit"},
  {serviceId:"am_likes",platform:"audiomack",serviceName:"Audiomack Likes",taskType:"like",minQuantity:100,maxQuantity:50000,customerUnitPrice:.012,taskerUnitReward:.0084,taskoraUnitMargin:.0036,pricingModel:"unit"},
  {serviceId:"ar_ios",platform:"app_review",serviceName:"iOS App Reviews",taskType:"review",minQuantity:10,maxQuantity:500,customerUnitPrice:1.5,taskerUnitReward:1.05,taskoraUnitMargin:.45,pricingModel:"unit"},
  {serviceId:"ar_android",platform:"app_review",serviceName:"Android App Reviews",taskType:"review",minQuantity:10,maxQuantity:500,customerUnitPrice:1.5,taskerUnitReward:1.05,taskoraUnitMargin:.45,pricingModel:"unit"},
  {serviceId:"ar_ratings",platform:"app_review",serviceName:"App Ratings",taskType:"rating",minQuantity:20,maxQuantity:1000,customerUnitPrice:.5,taskerUnitReward:.35,taskoraUnitMargin:.15,pricingModel:"unit"},
  {serviceId:"gb_reviews",platform:"google",serviceName:"Google Business Reviews",taskType:"review",minQuantity:10,maxQuantity:200,customerUnitPrice:.25,taskerUnitReward:.175,taskoraUnitMargin:.075,pricingModel:"unit"},
  {serviceId:"gb_seo",platform:"google",serviceName:"Local SEO",taskType:"seo",minQuantity:1,maxQuantity:100,customerUnitPrice:1.5,taskerUnitReward:1.05,taskoraUnitMargin:.45,pricingModel:"unit"},
  {serviceId:"web_traffic",platform:"website",serviceName:"Website Traffic",taskType:"view",minQuantity:500,maxQuantity:100000,customerUnitPrice:.003,taskerUnitReward:.0021,taskoraUnitMargin:.0009,pricingModel:"unit"},
  {serviceId:"web_signups",platform:"website",serviceName:"Website Sign-ups",taskType:"signup",minQuantity:20,maxQuantity:5000,customerUnitPrice:.04,taskerUnitReward:.028,taskoraUnitMargin:.012,pricingModel:"unit"},
  {serviceId:"web_clicks",platform:"website",serviceName:"Website Link Clicks",taskType:"click",minQuantity:100,maxQuantity:50000,customerUnitPrice:.008,taskerUnitReward:.0056,taskoraUnitMargin:.0024,pricingModel:"unit"},
  {serviceId:"sv_responses",platform:"survey",serviceName:"Survey Responses",taskType:"response",minQuantity:20,maxQuantity:5000,customerUnitPrice:1,taskerUnitReward:.7,taskoraUnitMargin:.3,pricingModel:"unit"},
  {serviceId:"sv_votes",platform:"survey",serviceName:"Poll Votes",taskType:"vote",minQuantity:20,maxQuantity:50000,customerUnitPrice:.5,taskerUnitReward:.35,taskoraUnitMargin:.15,pricingModel:"unit"},
  {serviceId:"pin_followers",platform:"pinterest",serviceName:"Pinterest Followers",taskType:"follow",minQuantity:100,maxQuantity:10000,customerUnitPrice:.02,taskerUnitReward:.014,taskoraUnitMargin:.006,pricingModel:"unit"},
  {serviceId:"pin_saves",platform:"pinterest",serviceName:"Pinterest Saves",taskType:"save",minQuantity:100,maxQuantity:50000,customerUnitPrice:.015,taskerUnitReward:.0105,taskoraUnitMargin:.0045,pricingModel:"unit"},
  {serviceId:"rd_upvotes",platform:"reddit",serviceName:"Reddit Upvotes",taskType:"upvote",minQuantity:100,maxQuantity:10000,customerUnitPrice:.3,taskerUnitReward:.21,taskoraUnitMargin:.09,pricingModel:"unit"},
  {serviceId:"rd_comments",platform:"reddit",serviceName:"Reddit Comments",taskType:"comment",minQuantity:20,maxQuantity:2000,customerUnitPrice:.5,taskerUnitReward:.35,taskoraUnitMargin:.15,pricingModel:"unit"},
  {serviceId:"tw_followers",platform:"twitch",serviceName:"Twitch Followers",taskType:"follow",minQuantity:100,maxQuantity:10000,customerUnitPrice:.025,taskerUnitReward:.0175,taskoraUnitMargin:.0075,pricingModel:"unit"},
  {serviceId:"tw_views",platform:"twitch",serviceName:"Twitch Views",taskType:"view",minQuantity:500,maxQuantity:50000,customerUnitPrice:.003,taskerUnitReward:.0021,taskoraUnitMargin:.0009,pricingModel:"unit"},
  {serviceId:"tw_chat",platform:"twitch",serviceName:"Twitch Chat Engagement",taskType:"engage",minQuantity:20,maxQuantity:5000,customerUnitPrice:.025,taskerUnitReward:.0175,taskoraUnitMargin:.0075,pricingModel:"unit"},
];

export const ADVERTISE_PLATFORMS = [...new Set(ADVERTISE_SERVICES.map((s) => s.platform))];

export function calculateAdvertiseOrder(service: AdvertiseService, quantity: number, watchSeconds = 0) {
  const units = service.pricingModel === "watch_second" ? Math.max(1, Math.floor(watchSeconds)) : Math.max(1, Math.floor(quantity));
  return {
    customerTotal: Number((service.customerUnitPrice * units).toFixed(8)),
    taskerBudget: Number((service.taskerUnitReward * units).toFixed(8)),
    taskoraMargin: Number((service.taskoraUnitMargin * units).toFixed(8)),
    units,
  };
}
