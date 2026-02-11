-- ============================================================
-- Identity profiles (per-user identity blueprints)
-- ============================================================
--
-- This table stores high-level, user-defined identity configuration that
-- would otherwise live in private markdown notes: values documents,
-- busy-day protocols, recovery approaches, and other narrative context.
--
-- The app can treat this as optional structured context; all fields are
-- nullable and can evolve over time.

create table public.identity_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Free-text values document or similar identity statement.
  values_document text,

  -- JSON blobs for various protocols and phase metadata.
  busy_day_protocol jsonb,
  recovery_protocol jsonb,
  comparison_protocol jsonb,
  phase_metadata jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (user_id)
);

create index idx_identity_profiles_user on public.identity_profiles(user_id);

alter table public.identity_profiles enable row level security;

create policy "Users can manage own identity_profiles"
  on public.identity_profiles
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

