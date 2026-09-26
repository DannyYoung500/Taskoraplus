export const COUNTRY_CODES = "AF,AL,DZ,AS,AD,AO,AI,AQ,AG,AR,AM,AW,AU,AT,AZ,BS,BH,BD,BB,BY,BE,BZ,BJ,BM,BT,BO,BQ,BA,BW,BV,BR,IO,BN,BG,BF,BI,CV,KH,CM,CA,KY,CF,TD,CL,CN,CX,CC,CO,KM,CG,CD,CK,CR,HR,CU,CW,CY,CZ,CI,DK,DJ,DM,DO,EC,EG,SV,GQ,ER,EE,SZ,ET,FK,FO,FJ,FI,FR,GF,PF,TF,GA,GM,GE,DE,GH,GI,GR,GL,GD,GP,GU,GT,GG,GN,GW,GY,HT,HM,VA,HN,HK,HU,IS,IN,ID,IR,IQ,IE,IM,IL,IT,JM,JP,JE,JO,KZ,KE,KI,KP,KR,KW,KG,LA,LV,LB,LS,LR,LY,LI,LT,LU,MO,MG,MW,MY,MV,ML,MT,MH,MQ,MR,MU,YT,MX,FM,MD,MC,MN,ME,MS,MA,MZ,MM,NA,NR,NP,NL,NC,NZ,NI,NE,NG,NU,NF,MK,MP,NO,OM,PK,PW,PS,PA,PG,PY,PE,PH,PN,PL,PT,PR,QA,RO,RU,RW,RE,BL,SH,KN,LC,MF,PM,VC,WS,SM,ST,SA,SN,RS,SC,SL,SG,SX,SK,SI,SB,SO,ZA,GS,SS,ES,LK,SD,SR,SJ,SE,CH,SY,TW,TJ,TZ,TH,TL,TG,TK,TO,TT,TN,TM,TC,TV,TR,UG,UA,AE,GB,US,UM,UY,UZ,VU,VE,VN,VG,VI,WF,EH,YE,ZM,ZW,AX".split(",");
export function countryNameFromCode(code: string | null | undefined): string | null {
  const c=String(code??"").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return null;
  try { return new Intl.DisplayNames(["en"], {type:"region"}).of(c) ?? c; } catch { return c; }
}
export function countryFlag(code: string | null | undefined): string {
  const c=String(code??"").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return "🌎";
  return String.fromCodePoint(...[...c].map(ch=>0x1f1e6+ch.charCodeAt(0)-65));
}
export const COUNTRIES = COUNTRY_CODES.map(code => ({code,name:countryNameFromCode(code) ?? code,flag:countryFlag(code)}));
export function isCountryCode(code: string | null | undefined): boolean {
  const c=String(code??"").trim().toUpperCase();
  return COUNTRY_CODES.includes(c);
}
export async function isTaskEligibleForUser(opts: {supabaseAdmin:any; task:any; userId:string}): Promise<boolean> {
  const target=String(opts.task?.target_country_code??"").trim().toUpperCase();
  if (!target) return true;
  const {data:profile}=await opts.supabaseAdmin.from("profiles").select("country_code,status").eq("id",opts.userId).maybeSingle();
  const userCountry=String(profile?.country_code??"").trim().toUpperCase();
  if (userCountry===target && String(profile?.status??"active")==="active") return true;
  if (opts.task?.allow_other_countries_if_unavailable===false) return false;
  const {count}=await opts.supabaseAdmin.from("profiles").select("id",{count:"exact",head:true}).eq("country_code",target).eq("status","active");
  return (count??0)===0;
}
