# TASKORA SQL — what to run

## In Supabase Dashboard → SQL Editor

### 1. Core (only if tables missing)

`supabase/RUN_IN_SUPABASE_SQL_EDITOR.sql`

Creates: profiles, tasks, submissions, transactions, withdrawals, roles, campaigns, etc.

### 2. Addons (always safe to re-run)

`supabase/RUN_EVERYTHING_ADDONS.sql`

Creates:
- support_tickets
- announcements
- telegram_gate_settings / events / bypass
- audit_logs (if missing)
- profile columns telegram_id, photo_url, status

## After SQL

1. Redeploy Vercel
2. Owner → Settings → Telegram Gate (optional)
3. Bot must be **admin** of the channel for membership checks


### 3. Crypto wallet foundation (after core tables exist)

Apply `supabase/migrations/20261027220000_crypto_wallet_foundation.sql` in Supabase SQL Editor, or deploy it through the Supabase migration workflow.

This migration is additive and preserves existing balances and transactions. It adds:
- Network-specific crypto configuration for USDT TRC20/BEP20/ERC20, TON, BTC, ETH, and BNB BEP20.
- Deposit/withdrawal transaction metadata and query indexes.
- A service-role-only webhook event inbox with provider/event idempotency.
- Row-level security for network settings.

**All seeded networks start disabled and without addresses.** Configure and verify a real receive address or payment provider before enabling deposits. This schema alone does not verify blockchain payments or automatically send withdrawals; signed provider webhooks and a server-side payment integration are still required.
