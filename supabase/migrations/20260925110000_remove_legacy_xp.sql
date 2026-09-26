-- Taskora uses Task Points only. Remove the legacy XP economy field.
alter table public.economy_settings drop column if exists daily_checkin_xp;
