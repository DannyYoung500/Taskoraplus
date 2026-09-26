# How to give Grok write access to Supabase SQL

Right now GitHub write works. **Supabase SQL tools are not available in this chat**, even though the project is linked (`cyczvbhcfwzmmisslvwz`).

## Option A — Manual (works now)

1. Open [Supabase Dashboard](https://supabase.com/dashboard)
2. Select project `cyczvbhcfwzmmisslvwz`
3. Go to **SQL Editor** → **New query**
4. Paste the full contents of `supabase/RUN_IN_SUPABASE_SQL_EDITOR.sql`
5. Click **Run**

## Option B — Give Grok SQL tools (preferred)

In Grok / xAI connectors:

1. Open **Connected apps / Connectors**
2. Find **Supabase** for this project
3. Disconnect and **reconnect**, granting:
   - Database read
   - Database write / execute SQL
   - Migrations (if listed)
4. Confirm the connection includes **SQL** or **Database** features (not only Docs)
5. Come back to this chat and say: **"Supabase SQL reconnected — run the migration"**

When tools appear, Grok can call `execute_sql` / `apply_migration` and apply schema without you pasting.

## Option C — Service role (do not paste in chat)

Do **not** send the service role key in chat. Keep it only in Vercel/Lovable env as `SUPABASE_SERVICE_ROLE_KEY`.

## After SQL runs

Confirm in Vercel env:

```
TASKORA_OWNER_TELEGRAM_IDS=<your numeric id>
TELEGRAM_BOT_TOKEN=...
SUPABASE_URL=...
SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Open the Mini App once → owner admin role auto-grants.
