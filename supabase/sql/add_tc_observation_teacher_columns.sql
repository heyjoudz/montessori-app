alter table if exists public.tc_observations
  add column if not exists teacher_name text,
  add column if not exists teacher_tc_id text;
