-- TaskoraPlus foundation cleanup.
-- Payout-proof channel UI was retired in favor of direct task/withdrawal
-- notifications. The persistent settings and public image policy are no longer used.
drop policy if exists "Public payout proof images are readable" on storage.objects;
drop table if exists public.payout_proof_settings;

-- The legacy payout-proofs bucket may remain as an empty storage container
-- because Supabase protects direct SQL deletion of storage objects/buckets.
