-- ============================================================
-- Four-week reviews (every 4 Sundays)
-- ============================================================

create table public.four_week_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  period_end_date date not null,
  reflection_summary text,
  goal_id uuid references public.goals(id) on delete set null,
  system_adjustment_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, period_end_date)
);

create index idx_four_week_reviews_user on public.four_week_reviews(user_id);
create index idx_four_week_reviews_period on public.four_week_reviews(user_id, period_end_date);

alter table public.four_week_reviews enable row level security;
create policy "Users can manage own four_week_reviews" on public.four_week_reviews
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
