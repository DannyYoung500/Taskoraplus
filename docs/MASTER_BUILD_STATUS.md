# TASKORA — Build status & remaining

## Done (this phase)

- Premium Mini App UX (loader 10 stages, home design, gold theme)
- Telegram auth path (initData → session)
- Tasks marketplace from DB, submit → pending → owner review
- Wallet + withdrawals with **24h new-account hold** + **shared address check**
- Submission **velocity limit** (12/hour)
- Owner Control Center modules: reviews, withdrawals, users, tasks, fraud, analytics, settings, tickets, announce
- Support tickets + announcements (SQL addon)
- Connected accounts (no Telegram)
- Leaderboard, referrals, advertise publish
- Watch & Earn honest stub

## Left intentionally

- **Bot Start → language → welcome** (your next feature pack)

## Remaining product work

1. Real platform verification (YouTube/X/Telegram channel membership APIs)
2. Watch & Earn provider postbacks (AdMob / offerwall signed callbacks)
3. Advertiser funding ledger (deposit USDT → campaign budget)
4. Push notifications (Telegram bot messages for reviews/payouts)
5. Apply full SQL (`RUN_IN_SUPABASE_SQL_EDITOR.sql` + `ADDONS_SUPPORT_ANNOUNCEMENTS.sql`)
6. Owner visible only when `TASKORA_OWNER_TELEGRAM_IDS` matches numeric Telegram ID after redeploy
7. TanStack `routeTree.gen.ts` regeneration on Vercel build for new owner routes

## Stronger recommendations still worth adding later

- Risk score 0–100 per user
- Device / IP fingerprinting (privacy-aware)
- KYC-lite for large withdrawals
- Multi-currency display
- A/B task ranking
- Geo eligibility rules
- Telegram Stars hybrid monetization
- Automated weekly leaderboard prize pool
