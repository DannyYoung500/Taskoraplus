# TASKORA — Master Build Status

## Done in recent commits

- Telegram-only auth UI (no Google/email/password forms)
- Server `validateTelegramInitData` + `validateTelegramSession` (HMAC)
- Bottom nav: Home · Tasks · Watch · Wallet · Profile
- `/home` + `/watch-earn` routes
- Tasks list/detail load from Supabase (not hardcoded TASKS array)
- `submitTask` never auto-credits — always `pending`
- Owner `reviewSubmission` (idempotent reward) + `listPendingSubmissions`
- Schema migration draft: telegram_id, campaigns, connected_accounts, watch_*, audit_logs, owner_settings

## Remaining (priority order)

1. **Session bridge** — after valid initData, create/link user by `telegram_id` and issue real app session (replace Supabase email gate)
2. **Apply migration** on Supabase (`20260912103000_master_schema_expand.sql`)
3. **Set `TELEGRAM_BOT_TOKEN`** (server only)
4. **Owner UI** — review queue consuming `listPendingSubmissions` / `reviewSubmission`
5. **Advertise flow** — platform → type → configure → fund → publish → campaign rows
6. **Connected accounts** — real verification per platform (Telegram membership needs bot admin)
7. **Watch & Earn provider** — signed callbacks, limits, cooldown, unique provider_tx_id
8. **Full Owner Control Center** modules (overview, users, fraud, settings, branding, legal…)
9. **Bot flow** — Start → language → welcome → Open Mini App + webhook
10. **Deposits** + provider webhooks; withdrawal owner review states
11. **XP / leaderboards / notifications / support tickets**
12. **Remove leftover demo seed reliance**; regenerate `routeTree.gen.ts` on build
13. **E2E inside Telegram** acceptance tests from master prompt §37

## Non-claims

- Do not claim Watch & Earn, Advertise funding, or Telegram membership verification work until providers/bot admin are configured and tested.
- Do not claim balances/rewards without ledger rows.
