# Cron — enable AFTER development is finished

Current `vercel.json` has **no crons** so builds stay fast and predictable.

When you are ready to turn crons on, append to `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "tanstack-start",
  "crons": [
    { "path": "/api/cron/strong-nightly", "schedule": "0 3 * * *" },
    { "path": "/api/cron/membership-recheck", "schedule": "0 */6 * * *" },
    { "path": "/api/cron/stuck-withdrawals", "schedule": "0 */4 * * *" },
    { "path": "/api/cron/ops-digest", "schedule": "0 9 * * *" }
  ]
}
```

Also set env `CRON_SECRET` (or `TASKORA_CRON_SECRET`) on Vercel.

Until then, run from **Owner → System Health**:
- Membership leave-check (TG + Discord)
- Strong nightly suite
- Stuck WD / campaigns alerts
