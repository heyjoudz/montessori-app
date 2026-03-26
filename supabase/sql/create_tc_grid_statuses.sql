create table if not exists public.tc_grid_statuses (
  id bigserial primary key,
  tc_level_key text not null,
  child_tc_id text not null,
  lesson_tc_id text not null,
  student_id bigint references public.students(id) on delete set null,
  classroom_id bigint,
  curriculum_activity_id bigint references public.tc_curriculum_activities(id) on delete set null,
  curriculum_category_id bigint references public.tc_curriculum_categories(id) on delete set null,
  curriculum_area_id bigint references public.tc_curriculum_areas(id) on delete set null,
  lesson_name text,
  category_name text,
  area_name text,
  proficiency integer,
  derived_status text not null,
  planned boolean not null default false,
  planned_by bigint,
  introduced boolean not null default false,
  practicing boolean not null default false,
  mastered boolean not null default false,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index if not exists tc_grid_statuses_tc_level_key_idx
  on public.tc_grid_statuses (tc_level_key);

create index if not exists tc_grid_statuses_child_tc_id_idx
  on public.tc_grid_statuses (child_tc_id);

create index if not exists tc_grid_statuses_lesson_tc_id_idx
  on public.tc_grid_statuses (lesson_tc_id);

create index if not exists tc_grid_statuses_student_id_idx
  on public.tc_grid_statuses (student_id);

create index if not exists tc_grid_statuses_classroom_id_idx
  on public.tc_grid_statuses (classroom_id);

create index if not exists tc_grid_statuses_derived_status_idx
  on public.tc_grid_statuses (derived_status);

alter table public.tc_grid_statuses enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'tc_grid_statuses'
      and policyname = 'tc_grid_statuses_authenticated_select'
  ) then
    create policy "tc_grid_statuses_authenticated_select"
      on public.tc_grid_statuses
      for select
      to authenticated
      using (true);
  end if;
end
$$;
