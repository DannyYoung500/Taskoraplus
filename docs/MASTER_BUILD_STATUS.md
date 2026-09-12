# TASKORA — Master Build Status

Last updated against `TASKORA_Master_Build_Prompt.md`.

## Stack (current repo)

- TanStack Start + Vite + React 19
- Supabase (Postgres + Auth + RLS)
- Lovable cloud auth helpers (must not drive production auth)

## What exists today (partial)

| Area | Status |
|------|--------|
| UI shell (mobile cards, PlatformIcon, TaskCard, BottomNav) | Present |
| Landing page | Present (website-style; not Mini App-first) |
| Tasks list/detail routes | Present |
| Wallet route + withdrawal server fn | Partial |
| Submissions + transactions tables | Partial |
| Server fns: listTasks, getTask, getDashboard, submitTask, dailyCheckin, requestWithdrawal, applyReferral | Partial |
| RLS on core tables | Partial |
| Seed tasks in SQL | Present (demo seed — must not ship as fake marketplace) |

## Non-negotiable gaps (must fix for production)

### Auth
- [x] Removed Google + email/password from auth UI (this commit)
- [ ] Server-side Telegram `initData` HMAC validation as sole auth
- [ ] Telegram user ID as primary external identity
- [ ] Session issuance after validation (no Supabase email users as primary)
- [ ] No Lovable Google OAuth in production path

### Navigation (spec: HOME · TASKS · WATCH & EARN · WALLET · PROFILE)
- [x] BottomNav updated to match (this commit)
- [x] `/home` route added (this commit)
- [x] `/watch-earn` stub route (this commit)
- [ ] Real Watch & Earn provider integration

### Data / ledger
- [ ] Normalized schema for campaigns, advertiser accounts, connected_accounts, watch sessions, fraud_events, audit_logs, feature_flags, xp/levels, leaderboards, deposits, notifications, support tickets
- [ ] Immutable wallet ledger with atomic balance rules
- [ ] No balance without ledger row
- [ ] Idempotent reward crediting (no double credit)
- [ ] Remove hardcoded `TASKS` / `LEDGER` / `USER` demo data from client

### Tasks & Advertise
- [ ] Full advertise flow: platform → type → configure → review → fund → publish
- [ ] Campaign statuses (Draft → … → Cancelled)
- [ ] Server-side eligibility via connected verified accounts
- [ ] Real proof review queue (owner approve/reject)
- [ ] Stop auto-rewarding `proof=auto` without real verification
- [ ] Real platform verification adapters (Telegram membership requires bot admin, etc.)

### Watch & Earn
- [ ] Provider server callbacks + signature verification
- [ ] Daily limits, cooldown, eligibility
- [ ] Idempotent completion IDs
- [ ] Owner controls for rewards/limits/fraud

### Owner Control Center
- [ ] Full owner dashboard modules (overview, users, advertisers, tasks, campaigns, review, wallets, deposits, withdrawals, transactions, fraud, referrals, leaderboards, XP, watch & earn, notifications, support, telegram, integrations, health, settings, branding, legal, audit)
- [ ] Server-side owner authorization on every mutation

### Telegram product flow
- [ ] Bot: Start → language → welcome → Open Mini App
- [ ] BotFather Mini App URL + loading branding
- [ ] Webhook secret verification

### Security
- [ ] No service-role in browser
- [ ] Webhook signature verification
- [ ] Rate limits / fraud signals
- [ ] Financial values never trusted from client

## Honest scope note

The master prompt describes a multi-month production system. This repository is a strong UI/server-function starting point, not a finished product. Remaining work must be done incrementally with real provider credentials, bot admin setup, and E2E tests inside Telegram.
