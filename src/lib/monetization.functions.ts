import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnerTelegramId } from "@/lib/owner";

async function adminClient() { const { supabaseAdmin } = await import("@/integrations/supabase/client.server"); return supabaseAdmin; }
async function assertOwner(userId: string) {
  const s = await adminClient();
  const { data: role } = await s.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (role) return;
  const { data: p } = await s.from("profiles").select("telegram_id").eq("id", userId).maybeSingle();
  if (isOwnerTelegramId((p as any)?.telegram_id ?? null)) return;
  throw new Error("Owner/admin authorization required.");
}

export type MonetizationProvider = {
  id:string; category:string; providerKey:string; providerName:string; enabled:boolean; priority:number;
  apiBaseUrl:string|null; publicId:string|null; placementId:string|null; postbackUrl:string|null; webhookUrl:string|null;
  revenueSharePercent:number|null; userRewardSharePercent:number|null; minimumPayoutUsd:number|null; settings:Record<string,unknown>; secretNames:string[];
};
function map(row:any): MonetizationProvider { return { id:String(row.id), category:String(row.category), providerKey:String(row.provider_key), providerName:String(row.provider_name), enabled:Boolean(row.enabled), priority:Number(row.priority??100), apiBaseUrl:row.api_base_url??null, publicId:row.public_id??null, placementId:row.placement_id??null, postbackUrl:row.postback_url??null, webhookUrl:row.webhook_url??null, revenueSharePercent:row.revenue_share_percent==null?null:Number(row.revenue_share_percent), userRewardSharePercent:row.user_reward_share_percent==null?null:Number(row.user_reward_share_percent), minimumPayoutUsd:row.minimum_payout_usd==null?null:Number(row.minimum_payout_usd), settings:(row.settings??{}) as Record<string,unknown>, secretNames:Array.isArray(row.secret_names)?row.secret_names.map(String):[] }; }

export const listMonetizationProviders=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{await assertOwner(context.userId);const s=await adminClient();const{data,error}=await(s as any).from("monetization_providers").select("*").order("category").order("priority");if(error)throw new Error(error.message);return((data??[])as any[]).map(map);});

export const saveMonetizationProvider=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((data:{id:string;enabled:boolean;priority:number;apiBaseUrl?:string;publicId?:string;placementId?:string;postbackUrl?:string;webhookUrl?:string;revenueSharePercent?:number|null;userRewardSharePercent?:number|null;minimumPayoutUsd?:number|null;settings?:Record<string,unknown>;secrets?:Array<{name:string;value:string;description?:string}>})=>data).handler(async({data,context})=>{await assertOwner(context.userId);const s=await adminClient();const{data:provider,error}=await(s as any).from("monetization_providers").select("provider_key,provider_name,secret_names").eq("id",data.id).single();if(error||!provider)throw new Error("Provider not found.");const secretNames:Array<string>=Array.isArray(provider.secret_names)?provider.secret_names.map(String):[];for(const secret of data.secrets??[]){if(!secret.value.trim())continue;const safeName=`taskora_${String(provider.provider_key).replace(/[^a-z0-9_]/gi,"_")}_${secret.name.replace(/[^a-z0-9_]/gi,"_")}`;const{data:secretId,error:secretError}=await(s as any).rpc("owner_monetization_save_secret",{p_name:safeName,p_secret:secret.value.trim(),p_description:secret.description??`${provider.provider_name} ${secret.name}`});if(secretError)throw new Error(secretError.message);if(secretId&&!secretNames.includes(safeName))secretNames.push(safeName);}
const{data:updated,error:updateError}=await(s as any).from("monetization_providers").update({enabled:Boolean(data.enabled),priority:Math.max(1,Math.floor(Number(data.priority)||100)),api_base_url:data.apiBaseUrl?.trim()||null,public_id:data.publicId?.trim()||null,placement_id:data.placementId?.trim()||null,postback_url:data.postbackUrl?.trim()||null,webhook_url:data.webhookUrl?.trim()||null,revenue_share_percent:data.revenueSharePercent==null?null:Number(data.revenueSharePercent),user_reward_share_percent:data.userRewardSharePercent==null?null:Number(data.userRewardSharePercent),minimum_payout_usd:data.minimumPayoutUsd==null?null:Number(data.minimumPayoutUsd),settings:data.settings??{},secret_names:secretNames,updated_at:new Date().toISOString()}).eq("id",data.id).select("*").single();if(updateError)throw new Error(updateError.message);return map(updated);});
