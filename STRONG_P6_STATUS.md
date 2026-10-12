# Strong P6 status

## Live on main
- `src/lib/strong-p6.functions.ts` — liveness, device score, dest fingerprint, velocity circuit, escrow ladder, SLA, trust-tier rank
- `src/lib/strong-fortress.functions.ts` — velocity circuit after every verified submission
- `src/lib/taskora-mutations-wd-velocity.impl.ts` — dest fingerprint + device score on withdraw
- `STRONG_P6_RUN_ONCE.sql` — run once in Supabase

## Enable
1. Run `STRONG_P6_RUN_ONCE.sql` in Supabase SQL editor
2. Deploy / hard-refresh Mini App

## Owner Health (next)
- Run campaign velocity circuits
- Owner SLA snapshot (7d)

## Submit liveness (next)
- assertProofSanity can enforce live codes for high-value screenshots when userId/taskId passed
