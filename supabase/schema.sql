-- マイトレーニング: Supabase スキーマ
-- Supabaseダッシュボード > SQL Editor に貼り付けて実行してください。
-- 実行後、Project Settings > API から「Project URL」と「anon public key」を
-- js/supabase-config.js に設定するとクラウド同期が有効になります。

create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gender text,
  age integer,
  height_cm numeric,
  weight_kg numeric,
  activity_level text,
  goal text,
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "profiles_own" on public.profiles;
create policy "profiles_own" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.weight_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  weight_kg numeric not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);
alter table public.weight_logs enable row level security;
drop policy if exists "weight_logs_own" on public.weight_logs;
create policy "weight_logs_own" on public.weight_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.exercises (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  category text,
  type text,
  cardio_mode text,
  rep_min integer,
  rep_max integer,
  target_sets integer,
  day text,
  start_weight numeric,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.exercises enable row level security;
drop policy if exists "exercises_own" on public.exercises;
create policy "exercises_own" on public.exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.workout_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  date date not null,
  exercise_id text not null,
  sets jsonb,
  cardio jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.workout_sessions enable row level security;
drop policy if exists "workout_sessions_own" on public.workout_sessions;
create policy "workout_sessions_own" on public.workout_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.routines (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  name text not null,
  exercise_ids jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);
alter table public.routines enable row level security;
drop policy if exists "routines_own" on public.routines;
create policy "routines_own" on public.routines
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
