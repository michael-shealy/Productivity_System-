-- ============================================================
-- Productivity System — Initial Schema
-- Run this in the Supabase SQL Editor (or via supabase db push)
-- ============================================================

-- 1. user_oauth_tokens
create table public.user_oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null check (provider in ('todoist', 'google')),
  access_token text not null,
  refresh_token text,
  token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

alter table public.user_oauth_tokens enable row level security;
create policy "Users can manage own tokens" on public.user_oauth_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 2. goals
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  slug text not null,
  title text not null,
  domain text not null,
  description text not null default '',
  season text not null default '',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, slug)
);

alter table public.goals enable row level security;
create policy "Users can manage own goals" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3. habits
create table public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_id text,
  title text not null,
  type text not null default '',
  kind text not null default 'check' check (kind in ('check', 'amount')),
  count integer not null default 0,
  period text not null default '',
  target_duration integer not null default 0,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create index idx_habits_user on public.habits(user_id);

alter table public.habits enable row level security;
create policy "Users can manage own habits" on public.habits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4. habit_sessions
create table public.habit_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  habit_id uuid not null references public.habits(id) on delete cascade,
  duration integer,
  amount integer,
  data text,
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create index idx_habit_sessions_user on public.habit_sessions(user_id);
create index idx_habit_sessions_habit on public.habit_sessions(habit_id);

alter table public.habit_sessions enable row level security;
create policy "Users can manage own habit sessions" on public.habit_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 5. daily_identity_metrics
create table public.daily_identity_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  morning_grounding boolean not null default false,
  embodied_movement boolean not null default false,
  nutritional_awareness boolean not null default false,
  present_connection boolean not null default false,
  curiosity_spark boolean not null default false,
  unique (user_id, date)
);

alter table public.daily_identity_metrics enable row level security;
create policy "Users can manage own identity metrics" on public.daily_identity_metrics
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 6. daily_morning_flow
create table public.daily_morning_flow (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  status text not null default 'idle' check (status in ('idle', 'in_progress', 'complete')),
  step_briefing boolean not null default false,
  step_focus boolean not null default false,
  step_identity boolean not null default false,
  step_habits boolean not null default false,
  unique (user_id, date)
);

alter table public.daily_morning_flow enable row level security;
create policy "Users can manage own morning flow" on public.daily_morning_flow
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 7. daily_focus3
create table public.daily_focus3 (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  items jsonb not null default '[]'::jsonb,
  unique (user_id, date)
);

alter table public.daily_focus3 enable row level security;
create policy "Users can manage own focus3" on public.daily_focus3
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 8. daily_ai_briefings
create table public.daily_ai_briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  headline text not null default '',
  values_focus text not null default '',
  why_bullets jsonb not null default '[]'::jsonb,
  insights jsonb not null default '[]'::jsonb,
  unique (user_id, date)
);

alter table public.daily_ai_briefings enable row level security;
create policy "Users can manage own AI briefings" on public.daily_ai_briefings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
