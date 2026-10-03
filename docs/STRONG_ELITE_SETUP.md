# TASKORA Strong Elite — setup

## 1. Run SQL (Supabase SQL Editor)

Open and run once:

`supabase/STRONG_ELITE_RUN_ONCE.sql`

Addss: `trust_score`, `approved_count`, `rejected_count`, `device_fp`, `proof_hash`, `proof_perceptual_key`, `bonus_ad_sessions`, `fraud_flags`.

## 2. Wire withdrawal gates (if not already in taskora-mutations)

In `requestWithdrawalGuarded`, after you have `supabaseAdmin`:

```ts
const { runEliteWithdrawalGates } = await import("@/lib/strong-withdraw-gates");
await runEliteWithdrawalGates({ userId, amount: data.amount, supabaseAdmin });
```

Local tree already has trust + quality + graduated daily cap inlined.

## 3. AdsGram / Monetag (Watch & Earn bonus ad)

Env (Vercel):

- `VITE_ADSGRAM_BLOCK_ID` = your AdsGram blockId
- `VITE_MONETAG_SHOW_FN` = generated show function name (fallback)
- `ADSGRAM_POSTBACK_SECRET` = optional HMAC for `adsNetworkRewardPostback`

Flow:
1. `getBonusAdSession()` → one-time token
2. `Adsgram.init({ blockId }).show()`
3. On reward → `creditBonusAd({ data: { sdkToken } })`

Without `VITE_ADSGRAM_BLOCK_ID`, credit still requires the server session token (no free-claim).

## 4. Owner Fraud page

`/owner/fraud` buttons:

- **Scan flags** — existing fraud signals
- **Cluster scan** — device_fp multi-account ≥3 → owner channel
- **Run ops cron** — stuck WD + campaigns + clusters + task SLA
- **Risk snapshot** — trust / quality / A/R for a user UUID

## 5. Graduated daily withdrawal by trust

| Trust | Daily cap |
|-------|-----------|
| 40–59 | $5 |
| 60–79 | $15 |
| 80+ | $500 (or policy max) |

Min trust to withdraw: **40**. Min Telegram quality: **35** (username + photo help).
