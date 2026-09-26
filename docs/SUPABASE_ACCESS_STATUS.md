# Supabase tool access status

As of last check in this chat:

- GitHub write: **working**
- Vercel tools: **present**
- Supabase execute SQL / list tables: **NOT available** to Grok tools

Even after reconnect, the connector must expose **Database** tools (execute_sql / list_tables / apply_migration).

## What you should see when it works

After reconnect, Grok should be able to discover tools named like:

- `list_tables`
- `execute_sql`
- `apply_migration`

If only "Docs" is enabled, SQL cannot be run from chat.

## Until then

Run manually:

`supabase/RUN_IN_SUPABASE_SQL_EDITOR.sql`

in Supabase → SQL Editor → Run.
