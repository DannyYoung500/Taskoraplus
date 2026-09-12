# TASKORA — Master Build Status

## Recently completed

- Telegram initData HMAC validation
- **Telegram session bridge** (`loginWithTelegram`) → Supabase session tokens
- Auth UI sets session and opens `/home`
- Tasks load from DB; submit always pending
- Owner review API + `/owner/reviews` UI
- Advertise scaffold (platform → type → configure → owner publish)
- Schema expansion migration file
- Watch & Earn stub screen

## Required env (server)

- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_AUTH_SECRET` (optional; falls back to bot token)
- `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`

## Owner setup

Grant admin role in Supabase:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('<your-auth-user-uuid>', 'admin')
ON CONFLICT DO NOTHING;
```

## Remaining

1. Apply schema migration on Supabase if not applied
2. Regenerate TanStack `routeTree.gen.ts` via `npm run dev` / build
3. Bot Start → language → welcome → Open Mini App + webhook
4. Full advertiser funding / campaign budget ledger
5. Connected accounts + real platform verification
6. Watch & Earn provider callbacks + fraud controls
7. Full Owner Control Center (users, fraud, settings, branding, legal, support…)
8. Deposits webhooks; withdrawal owner workflow UI
9. XP / leaderboards / notifications
10. listUsers pagination for Telegram bridge (scale beyond 200 users)
11. E2E tests inside Telegram

## Non-claims

Provider payouts, social API verification, and full owner suite are not complete until configured and tested.
