# Telegram Channel Access Gate — setup

## 1. SQL

Run in Supabase SQL Editor:

`supabase/TELEGRAM_GATE.sql`

## 2. Bot permissions

1. Add `@Taskoraplusbot` as **admin** of your channel (can see members).
2. Channel ID: `@username` or numeric `-100...`

## 3. Owner UI

Owner → **Platform settings** → **Telegram Gate**

- Toggle **Enabled**
- Set Channel ID + URL
- **TEST TELEGRAM CONNECTION**
- **SAVE**

## 4. Behaviour

- Gate **off** → everyone continues normally
- Gate **on** → non-members see `/telegram-gate`
- Owner Telegram IDs always bypass
- Server-side `getChatMember` only (token never on client)
- Cached for `checkIntervalSeconds` (default 300)
