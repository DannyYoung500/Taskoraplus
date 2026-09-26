# Owner setup (Telegram ID as admin)

## 1. Find your Telegram numeric ID

Open `@userinfobot` or `@getidsbot` in Telegram and copy your **numeric user id** (example: `123456789`).

## 2. Set environment variables (server / Vercel / Lovable)

```
TELEGRAM_BOT_TOKEN=...
TASKORA_OWNER_TELEGRAM_IDS=123456789
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
TELEGRAM_AUTH_SECRET=long-random-string
```

Multiple owners: `TASKORA_OWNER_TELEGRAM_IDS=111,222,333`

## 3. Supabase schema

Run the SQL migrations in `supabase/migrations/` in the Supabase SQL editor (in order).

Especially ensure `profiles.telegram_id` exists (from `20260912103000_master_schema_expand.sql`).

## 4. Login once from the Mini App

When you open TASKORA from Telegram and complete **Continue with Telegram**:

- Your profile is upserted with `telegram_id`
- If your ID is in `TASKORA_OWNER_TELEGRAM_IDS`, you receive the `admin` role automatically

## 5. Owner screens

- `/owner` — overview
- `/owner/reviews` — approve/reject submissions
- `/advertise` — publish tasks (owner)

## Note on Supabase MCP

If Supabase tools are not available in this chat, apply SQL manually in the Supabase dashboard SQL editor.
