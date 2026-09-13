# TASKORA — Master Build Status

## Auth note (left pending per product owner)

JWT kid / ES256 error may still block Mini App login. Auth fix is tracked separately — product surfaces continue below.

## Built

- Telegram initData validation + login bridge (may need JWT fix)
- Owner by `TASKORA_OWNER_TELEGRAM_IDS`
- Tasks from DB; submit → pending; owner review
- Wallet live balance + withdrawal request
- Profile live stats + owner link
- Referrals live code + apply
- Connected accounts pending store
- Leaderboard from ledger
- Advertise owner publish
- Owner hub / reviews / withdrawals
- Watch & Earn UI stub

## Remaining

1. Fix JWT authentication (blocker for Mini App)
2. Run `supabase/RUN_IN_SUPABASE_SQL_EDITOR.sql` if not applied
3. Bot Start → language → welcome → Open App
4. Real platform verification adapters
5. Watch & Earn provider callbacks
6. Advertiser funding ledger
7. Full owner modules (fraud, settings, branding…)
8. Notifications system
9. XP levels configuration UI
10. E2E inside Telegram after auth works
