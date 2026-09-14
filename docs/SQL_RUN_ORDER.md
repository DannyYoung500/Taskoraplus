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
