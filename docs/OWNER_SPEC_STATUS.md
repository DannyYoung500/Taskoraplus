# TASKORA Owner Dashboard vs Master Spec PDF

## Implemented this pass (additive on existing repo)

| Spec area | Status |
|-----------|--------|
| Command Center menu (full scope links) | Done |
| Economy Controls (min WD $10, deposit $5, referral 5%, XP check-in) | Done |
| Task price catalog (seeded USD rates from PDF) | SQL + read UI |
| Feature Flags & Maintenance kill switches | Done |
| Audit Logs viewer | Done |
| System Health probes | Done |
| Telegram Gate channel/group | Done earlier |
| Documents PDF library | Done earlier |
| Users / Reviews / Withdrawals / Tasks | Existing |

## SQL

`supabase/OWNER_DASHBOARD_SPEC.sql`

## Remaining Owner Spec (next)

1. Connected Accounts owner controls (approve/revoke/cooldown)
2. Full Campaigns module (budget ledger, refund, CPA dashboard)
3. Ledger & Reconciliation views (double-entry UI)
4. Deposits module + provider webhooks
5. Roles & Permissions matrix (beyond Owner)
6. KYC campaign controls UI
7. Ads / Sponsored Video / YouTube Watch owner tiers
8. Referral XP / Levels config UI
9. Daily check-in aggregate owner stats
10. Notification templates owner editor
11. Payment provider settings (no secrets in UI)
12. Database diagnostics (safe counts only)

## Global remaining (from before Owner PDF)

1. Bot Start → language → welcome flow
2. Real platform verification APIs
3. Watch & Earn signed postbacks
4. Advertiser funding ledger
5. Bot push notifications
6. Attach PDF brief on task detail
7. Gate whitelist UI
8. First-withdrawal always manual review enforcement UI
