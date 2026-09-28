-- Verification & Trust workflow triggers are installed in Supabase.
-- This file mirrors the live migration applied to project cyczvbhcfwzmmisslvwz.
-- It creates server-side verification cases from real platform records.

create index if not exists verification_cases_status_updated_idx on public.verification_cases(status,updated_at desc);
create index if not exists verification_cases_subject_idx on public.verification_cases(subject_type,subject_id);
create index if not exists verification_events_case_created_idx on public.verification_events(case_id,created_at desc);