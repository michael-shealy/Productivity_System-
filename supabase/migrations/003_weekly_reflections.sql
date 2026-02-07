-- ============================================================
-- Weekly reflections (habit review loop)
-- Run in the Supabase SQL Editor (or via supabase db push)
-- ============================================================

create table public.weekly_reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start_date date not null,
  what_went_well text not null default '',
  what_mattered text not null default '',
  learnings text not null default '',
  capability_growth boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start_date)
);

create index idx_weekly_reflections_user on public.weekly_reflections(user_id);
create index idx_weekly_reflections_week on public.weekly_reflections(user_id, week_start_date);

alter table public.weekly_reflections enable row level security;
create policy "Users can manage own weekly reflections" on public.weekly_reflections
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
