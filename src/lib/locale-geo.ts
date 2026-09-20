/**
 * Presence + country helpers for TASKORA.
 * Country: prefer edge geo (CF / Vercel), fallback to Telegram language_code.
 * Online: last_active_at within ONLINE_MS.
 */

export const ONLINE_MS = 5 * 60 * 1000;
export const RECENT_MS = 60 * 60 * 1000;

/** ISO 3166-1 alpha-2 → display name */
const COUNTRY_NAMES: Record<string, string> = {
  NG: "Nigeria",
  GH: "Ghana",
  KE: "Kenya",
  ZA: "South Africa",
  US: "United States",
  GB: "United Kingdom",
  IN: "India",
  PK: "Pakistan",
  BD: "Bangladesh",
  PH: "Philippines",
  ID: "Indonesia",
  MY: "Malaysia",
  SG: "Singapore",
  AE: "UAE",
  SA: "Saudi Arabia",
  EG: "Egypt",
  TR: "Turkey",
  RU: "Russia",
  UA: "Ukraine",
  DE: "Germany",
  FR: "France",
  ES: "Spain",
  IT: "Italy",
  BR: "Brazil",
  MX: "Mexico",
  CA: "Canada",
  AU: "Australia",
  CN: "China",
  JP: "Japan",
  KR: "South Korea",
  VN: "Vietnam",
  TH: "Thailand",
  TZ: "Tanzania",
  UG: "Uganda",
  CM: "Cameroon",
  CI: "Côte d'Ivoire",
  SN: "Senegal",
  ET: "Ethiopia",
  RW: "Rwanda",
  ZM: "Zambia",
  ZW: "Zimbabwe",
  NL: "Netherlands",
  PL: "Poland",
  RO: "Romania",
  PT: "Portugal",
  AR: "Argentina",
  CO: "Colombia",
  PE: "Peru",
  CL: "Chile",
};

const LANG_TO_COUNTRY: Record<string, { code: string; name: string }> = {
  yo: { code: "NG", name: "Nigeria" },
  ha: { code: "NG", name: "Nigeria" },
  ig: { code: "NG", name: "Nigeria" },
  pcm: { code: "NG", name: "Nigeria" },
  sw: { code: "KE", name: "Kenya" },
  am: { code: "ET", name: "Ethiopia" },
  bn: { code: "BD", name: "Bangladesh" },
  ur: { code: "PK", name: "Pakistan" },
  hi: { code: "IN", name: "India" },
  te: { code: "IN", name: "India" },
  ta: { code: "IN", name: "India" },
  ml: { code: "IN", name: "India" },
  fil: { code: "PH", name: "Philippines" },
  tl: { code: "PH", name: "Philippines" },
  id: { code: "ID", name: "Indonesia" },
  ms: { code: "MY", name: "Malaysia" },
  vi: { code: "VN", name: "Vietnam" },
  th: { code: "TH", name: "Thailand" },
  ar: { code: "SA", name: "Arabic region" },
  tr: { code: "TR", name: "Turkey" },
  ru: { code: "RU", name: "Russia" },
  uk: { code: "UA", name: "Ukraine" },
  de: { code: "DE", name: "Germany" },
  fr: { code: "FR", name: "France" },
  es: { code: "ES", name: "Spain" },
  pt: { code: "BR", name: "Brazil / Portugal" },
  it: { code: "IT", name: "Italy" },
  pl: { code: "PL", name: "Poland" },
  ro: { code: "RO", name: "Romania" },
  nl: { code: "NL", name: "Netherlands" },
  zh: { code: "CN", name: "China" },
  ja: { code: "JP", name: "Japan" },
  ko: { code: "KR", name: "South Korea" },
  en: { code: "", name: "English" },
};

export function countryNameFromCode(code: string | null | undefined): string | null {
  if (!code) return null;
  const c = code.trim().toUpperCase();
  if (c.length !== 2) return null;
  return COUNTRY_NAMES[c] ?? c;
}

export function resolveCountryFromLanguage(lang: string | null | undefined): {
  code: string | null;
  name: string | null;
} {
  if (!lang) return { code: null, name: null };
  const base = lang.trim().toLowerCase().split(/[-_]/)[0] ?? "";
  const hit = LANG_TO_COUNTRY[base];
  if (!hit) return { code: null, name: base ? base.toUpperCase() : null };
  return { code: hit.code || null, name: hit.name };
}

export function countryFromRequestHeaders(headers: Headers | null | undefined): {
  code: string | null;
  name: string | null;
} {
  if (!headers) return { code: null, name: null };
  const raw =
    headers.get("cf-ipcountry") ||
    headers.get("x-vercel-ip-country") ||
    headers.get("x-country-code") ||
    headers.get("cloudfront-viewer-country") ||
    "";
  const code = raw.trim().toUpperCase();
  if (!code || code === "XX" || code === "T1" || code.length !== 2) {
    return { code: null, name: null };
  }
  return { code, name: countryNameFromCode(code) };
}

export type PresenceStatus = "online" | "recent" | "offline" | "unknown";

export function presenceFromLastActive(iso: string | null | undefined): {
  status: PresenceStatus;
  label: string;
  minutesAgo: number | null;
} {
  if (!iso) return { status: "unknown", label: "Never seen", minutesAgo: null };
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return { status: "unknown", label: "Unknown", minutesAgo: null };
  const diff = Date.now() - t;
  const minutesAgo = Math.max(0, Math.floor(diff / 60_000));
  if (diff <= ONLINE_MS) return { status: "online", label: "Online now", minutesAgo };
  if (diff <= RECENT_MS) {
    return {
      status: "recent",
      label: minutesAgo < 60 ? `${minutesAgo}m ago` : "Within 1h",
      minutesAgo,
    };
  }
  if (minutesAgo < 60 * 24) {
    const h = Math.floor(minutesAgo / 60);
    return { status: "offline", label: `${h}h ago`, minutesAgo };
  }
  const d = Math.floor(minutesAgo / (60 * 24));
  return { status: "offline", label: d === 1 ? "1d ago" : `${d}d ago`, minutesAgo };
}

export function formatCountryLine(opts: {
  country?: string | null;
  country_code?: string | null;
  language_code?: string | null;
}): string {
  const name =
    (opts.country && opts.country.trim()) ||
    countryNameFromCode(opts.country_code) ||
    null;
  const code = opts.country_code?.trim().toUpperCase() || null;
  const lang = opts.language_code?.trim().toLowerCase() || null;
  if (name && code) return lang ? `${name} (${code}) · ${lang}` : `${name} (${code})`;
  if (name) return lang ? `${name} · ${lang}` : name;
  if (code) return lang ? `${code} · ${lang}` : code;
  if (lang) return `Lang ${lang}`;
  return "—";
}
