-- ============================================================
-- User preferences (e.g. AI tone)
-- ============================================================

create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  preferences jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index idx_user_preferences_user on public.user_preferences(user_id);

alter table public.user_preferences enable row level security;
create policy "Users can manage own preferences" on public.user_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
