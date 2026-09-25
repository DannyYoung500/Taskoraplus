import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BOT="Taskoraplusbot";
const BIO_PLATFORMS=new Set(["x","tiktok","instagram","whatsapp","facebook","reddit","linkedin","twitch"]);

function makeLink(code?:string|null, telegramId?:number|null) {
  const id=String(code||telegramId||"").trim();
  if(!id) throw new Error("Your Taskora referral ID is not ready yet. Please try again.");
  return `https://t.me/${BOT}/?startapp=${encodeURIComponent(id)}`;
}
function makeMessage(link:string) { return `🚀 I earn money every day on TASKORA! Join me and start earning too 👇\n${link}`; }
async function save(userId:string,platform:string,values:Record<string,unknown>) {
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  const {data,error}=await supabaseAdmin.from("connected_accounts").upsert({user_id:userId,platform:platform as never,...values},{onConflict:"user_id,platform"}).select("*").single();
  if(error) throw new Error(error.message); return data;
}
export const listConnectedAccounts=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  const {data,error}=await supabaseAdmin.from("connected_accounts").select("*").eq("user_id",context.userId).order("created_at",{ascending:false});
  if(error){if(error.message.includes("does not exist"))return [];throw new Error(error.message);} return data??[];
});
export const getConnectedVerificationInfo=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  const {data,error}=await supabaseAdmin.from("profiles").select("referral_code,telegram_id").eq("id",context.userId).maybeSingle();
  if(error)throw new Error(error.message); const link=makeLink(data?.referral_code,data?.telegram_id); return {referralLink:link,message:makeMessage(link)};
});
export const beginDiscordConnect=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const clientId=process.env["DISCORD_CLIENT_ID"];
  const base=process.env["PUBLIC_APP_URL"]||(process.env["VERCEL_PROJECT_PRODUCTION_URL"]?"https://"+process.env["VERCEL_PROJECT_PRODUCTION_URL"]:"https://taskoraplusapp.vercel.app");
  if(!clientId)throw new Error("Discord connection is not configured yet.");
  const {signDiscordOAuthState}=await import("@/lib/discord-oauth.server");
  const redirectUri=base.replace(/\/$/,"")+"/api/discord/callback";
  const p=new URLSearchParams({client_id:clientId,response_type:"code",redirect_uri:redirectUri,scope:"identify",state:await signDiscordOAuthState(context.userId),prompt:"consent"});
  return {url:"https://discord.com/oauth2/authorize?"+p.toString()};
});
export const verifyYouTubeChannel=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:{channelUrl:string})=>d).handler(async({data,context})=>{
  const raw=data.channelUrl.trim(); if(!/^https?:\/\/(www\.)?youtube\.com\//i.test(raw))throw new Error("Enter a valid public YouTube channel URL.");
  const key=process.env["YOUTUBE_API_KEY"]; if(!key)throw new Error("YouTube verification is not configured on the server yet.");
  const u=new URL(raw),path=u.pathname.replace(/\/+$/,""),p=new URLSearchParams({part:"snippet,status",key});
  if(path.startsWith("/channel/"))p.set("id",path.slice(9)); else if(path.startsWith("/@"))p.set("forHandle",path.slice(2)); else if(path.startsWith("/user/"))p.set("forUsername",path.slice(6)); else throw new Error("Use a YouTube channel URL such as youtube.com/@yourchannel.");
  const r=await fetch("https://www.googleapis.com/youtube/v3/channels?"+p); const body=await r.json() as {items?:Array<{id:string;snippet?:{title?:string};status?:{privacyStatus?:string}}>;error?:{message?:string}};
  if(!r.ok)throw new Error(body.error?.message||"YouTube verification failed."); const c=body.items?.[0]; if(!c?.id)throw new Error("We could not find that YouTube channel."); if(c.status?.privacyStatus==="private")throw new Error("That YouTube channel is private and cannot be verified.");
  return save(context.userId,"youtube",{handle:c.snippet?.title||"YouTube channel",profile_url:"https://www.youtube.com/channel/"+c.id,external_id:c.id,status:"verified",verified_at:new Date().toISOString(),meta:{source:"youtube_data_api",submitted_url:raw}});
});
export const verifyPublicProfile=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:{platform:string;profileUrl:string})=>d).handler(async({data,context})=>{
  const platform=data.platform.trim().toLowerCase(); if(!BIO_PLATFORMS.has(platform))throw new Error("This platform uses a different connection method.");
  let url:URL; try{url=new URL(data.profileUrl.trim());}catch{throw new Error("Enter a valid public profile URL.");} if(url.protocol!=="https:")throw new Error("Use the public HTTPS profile URL.");
  const v=await getConnectedVerificationInfo(); let r:Response; try{r=await fetch(url.toString(),{redirect:"follow",headers:{"user-agent":"TASKORA/1.0 public-profile-verifier"}});}catch{throw new Error("We could not reach that profile. Make sure it is public and try again.");}
  if(r.status===401||r.status===403)throw new Error("Your profile must be public so Taskora can verify it."); if(!r.ok)throw new Error("We could not verify that profile (HTTP "+r.status+").");
  const html=(await r.text()).replace(/&amp;/g,"&").replace(/&#x2F;/gi,"/").toLowerCase();
  if(!html.includes(v.referralLink.toLowerCase())||!html.includes("i earn money every day on taskora"))throw new Error("We did not find the required message in your bio. Paste the message above into your public bio and try again.");
  return save(context.userId,platform,{handle:url.hostname,profile_url:url.toString(),external_id:url.toString(),status:"verified",verified_at:new Date().toISOString(),meta:{source:"public_profile_bio",required_message:v.message,referral_link:v.referralLink}});
});
