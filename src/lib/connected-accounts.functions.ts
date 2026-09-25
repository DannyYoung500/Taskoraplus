import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const BOT = "Taskoraplusbot";
const BIO_PLATFORMS = new Set(["x","tiktok","instagram","whatsapp","facebook","reddit","linkedin","twitch"]);

function makeReferralLink(code?: string | null, telegramId?: number | null) {
  const id = String(code || telegramId || "").trim();
  if (!id) throw new Error("Your Taskora referral ID is not ready yet. Please try again.");
  return `https://t.me/${BOT}/?startapp=${encodeURIComponent(id)}`;
}
function makeMessage(link: string, token?: string) {
  const unique = token ? `${link}&verify=${encodeURIComponent(token)}` : link;
  return `🚀 I earn money every day on TASKORA! Join me and start earning too 👇\n${unique}`;
}
async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}
export const listConnectedAccounts = createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const supabaseAdmin=await db();
  const {data,error}=await supabaseAdmin.from("connected_accounts").select("*").eq("user_id",context.userId).order("created_at",{ascending:false});
  if(error) throw new Error(error.message);
  return data??[];
});
export const getConnectedVerificationInfo = createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const supabaseAdmin=await db();
  const {data,error}=await supabaseAdmin.from("profiles").select("referral_code,telegram_id").eq("id",context.userId).maybeSingle();
  if(error) throw new Error(error.message);
  const link=makeReferralLink(data?.referral_code,data?.telegram_id);
  return {referralLink:link,message:makeMessage(link)};
});
export const startPublicProfileVerification = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:{platform:string;profileUrl:string})=>d).handler(async({data,context})=>{
  const platform=data.platform.trim().toLowerCase();
  if(!BIO_PLATFORMS.has(platform)) throw new Error("This platform uses a different connection method.");
  let url:URL; try { url=new URL(data.profileUrl.trim()); } catch { throw new Error("Enter a valid public profile URL."); }
  if(url.protocol!=="https:") throw new Error("Use the public HTTPS profile URL.");
  const supabaseAdmin=await db();
  const {data:profile,error:profileError}=await supabaseAdmin.from("profiles").select("referral_code,telegram_id").eq("id",context.userId).maybeSingle();
  if(profileError) throw new Error(profileError.message);
  const referralLink=makeReferralLink(profile?.referral_code,profile?.telegram_id);
  const token=crypto.randomUUID().replace(/-/g,"");
  const expiresAt=new Date(Date.now()+30*60*1000).toISOString();
  const {error}=await supabaseAdmin.from("connected_accounts").upsert({
    user_id:context.userId,platform,handle:"Pending verification",profile_url:url.toString(),
    external_id:null,status:"pending",verified_at:null,verification_token:token,
    verification_expires_at:expiresAt,verification_attempts:0,
    meta:{source:"public_profile_bio",verification_version:2}
  },{onConflict:"user_id,platform"});
  if(error) throw new Error(error.message);
  return {platform,profileUrl:url.toString(),token,expiresAt,referralLink,message:makeMessage(referralLink,token)};
});
export const beginDiscordConnect = createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const clientId=process.env["DISCORD_CLIENT_ID"];
  const base=process.env["PUBLIC_APP_URL"]||(process.env["VERCEL_PROJECT_PRODUCTION_URL"]?"https://"+process.env["VERCEL_PROJECT_PRODUCTION_URL"]:"https://taskoraplusapp.vercel.app");
  if(!clientId) throw new Error("Discord connection is not configured yet.");
  const {signDiscordOAuthState}=await import("@/lib/discord-oauth.server");
  const redirectUri=base.replace(/\/$/,"")+"/api/discord/callback";
  const p=new URLSearchParams({client_id:clientId,response_type:"code",redirect_uri:redirectUri,scope:"identify",state:await signDiscordOAuthState(context.userId),prompt:"consent"});
  return {url:"https://discord.com/oauth2/authorize?"+p.toString()};
});
export const verifyYouTubeChannel = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:{channelUrl:string})=>d).handler(async({data,context})=>{
  const raw=data.channelUrl.trim();
  if(!/^https?:\/\/(www\.)?youtube\.com\//i.test(raw)) throw new Error("Enter a valid public YouTube channel URL.");
  const key=process.env["YOUTUBE_API_KEY"]; if(!key) throw new Error("YouTube verification is not configured on the server yet.");
  const u=new URL(raw),path=u.pathname.replace(/\/+$/,""),p=new URLSearchParams({part:"snippet,status",key});
  if(path.startsWith("/channel/")) p.set("id",path.slice(9)); else if(path.startsWith("/@")) p.set("forHandle",path.slice(2)); else if(path.startsWith("/user/")) p.set("forUsername",path.slice(6)); else throw new Error("Use a YouTube channel URL such as youtube.com/@yourchannel.");
  const r=await fetch("https://www.googleapis.com/youtube/v3/channels?"+p); const body=await r.json() as {items?:Array<{id:string;snippet?:{title?:string};status?:{privacyStatus?:string}}>;error?:{message?:string}};
  if(!r.ok) throw new Error(body.error?.message||"YouTube verification failed.");
  const c=body.items?.[0]; if(!c?.id) throw new Error("We could not find that YouTube channel.");
  if(c.status?.privacyStatus==="private") throw new Error("That YouTube channel is private and cannot be verified.");
  return (await db()).from("connected_accounts").upsert({
    user_id:context.userId,platform:"youtube",handle:c.snippet?.title||"YouTube channel",profile_url:"https://www.youtube.com/channel/"+c.id,
    external_id:c.id,status:"verified",verified_at:new Date().toISOString(),verification_token:null,verification_expires_at:null,
    meta:{source:"youtube_data_api",submitted_url:raw}
  },{onConflict:"user_id,platform"}).select("*").single().then(({data,error})=>{if(error) throw new Error(error.message); return data;});
});
export const verifyPublicProfile = createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((d:{platform:string;profileUrl:string;token:string})=>d).handler(async({data,context})=>{
  const platform=data.platform.trim().toLowerCase();
  if(!BIO_PLATFORMS.has(platform)) throw new Error("This platform uses a different connection method.");
  const supabaseAdmin=await db();
  const {data:row,error:rowError}=await supabaseAdmin.from("connected_accounts").select("*").eq("user_id",context.userId).eq("platform",platform).eq("verification_token",data.token).maybeSingle();
  if(rowError) throw new Error(rowError.message);
  if(!row) throw new Error("This verification request is invalid or has already been replaced.");
  if(!row.verification_expires_at || new Date(row.verification_expires_at).getTime()<Date.now()) throw new Error("This verification message has expired. Generate a new one.");
  const submitted=new URL(data.profileUrl.trim()); if(submitted.protocol!=="https:") throw new Error("Use the public HTTPS profile URL.");
  if(submitted.toString()!==String(row.profile_url)) throw new Error("The profile URL does not match the verification request.");
  const nextAttempts=Number(row.verification_attempts||0)+1;
  if(nextAttempts>10) throw new Error("Too many verification attempts. Generate a new verification message.");
  await supabaseAdmin.from("connected_accounts").update({verification_attempts:nextAttempts}).eq("id",row.id);
  let r:Response; try { r=await fetch(submitted.toString(),{redirect:"follow",headers:{"user-agent":"TASKORA/2.0 public-profile-verifier"}}); } catch { throw new Error("We could not reach that profile. Make sure it is public and try again."); }
  if(r.status===401||r.status===403) throw new Error("Your profile must be public so Taskora can verify it.");
  if(!r.ok) throw new Error("We could not verify that profile (HTTP "+r.status+").");
  const rawHtml=await r.text();
  const html=rawHtml.replace(/&amp;/g,"&").replace(/&#x2F;/gi,"/").replace(/\s+/g," ").toLowerCase();
  const token=data.token.toLowerCase();
  if(!html.includes(token)||!html.includes("i earn money every day on taskora")) throw new Error("We did not find the required verification message in your public bio. Make sure the profile is public, paste the complete message, save it, and try again.");
  const {data:conflict}=await supabaseAdmin.from("connected_accounts").select("id").eq("platform",platform).eq("profile_url",submitted.toString()).eq("status","verified").neq("user_id",context.userId).maybeSingle();
  if(conflict) throw new Error("That public profile is already connected to another Taskora account.");
  const {data:verified,error}=await supabaseAdmin.from("connected_accounts").update({
    handle:submitted.hostname.replace(/^www\./,""),status:"verified",verified_at:new Date().toISOString(),
    verification_token:null,verification_expires_at:null,meta:{source:"public_profile_bio",verification_token:token,verified_url:submitted.toString()}
  }).eq("id",row.id).select("*").single();
  if(error) throw new Error(error.message);
  return verified;
});
