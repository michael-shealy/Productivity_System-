-- Daily weather summary for AI observation context
create table if not exists daily_weather (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  temp_high real,
  temp_low real,
  condition text,
  weather_code integer,
  precip_chance real,
  sunrise text,
  sunset text,
  created_at timestamptz default now(),
  unique (user_id, date)
);

alter table daily_weather enable row level security;

create policy "Users can read own weather" on daily_weather
  for select using (auth.uid() = user_id);

create policy "Users can insert own weather" on daily_weather
  for insert with check (auth.uid() = user_id);

create policy "Users can update own weather" on daily_weather
  for update using (auth.uid() = user_id);
