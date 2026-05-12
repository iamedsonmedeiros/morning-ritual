-- Supabase / PostgreSQL schema for app.edson.digital
-- MVP: routines, habits, goals, and daily consistency tracking

create extension if not exists pgcrypto;

-- Updated-at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Enums
DO $$ BEGIN
  CREATE TYPE public.goal_type AS ENUM ('disciplina', 'produtividade', 'habitos', 'rotina_da_manha');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.habit_frequency AS ENUM ('daily', 'weekly');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.goal_status AS ENUM ('active', 'paused', 'done');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE public.reminder_type AS ENUM ('routine', 'habit', 'goal');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Profiles
create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  name text,
  goal_type public.goal_type not null default 'rotina_da_manha',
  morning_minutes int not null default 15,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Routines
create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  is_default boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_routines_user_id on public.routines(user_id);
create index if not exists idx_routines_user_default on public.routines(user_id, is_default);

create trigger set_routines_updated_at
before update on public.routines
for each row execute function public.set_updated_at();

-- Routine steps
create table if not exists public.routine_steps (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  title text not null,
  description text,
  position int not null,
  minutes int,
  is_required boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (routine_id, position)
);

create index if not exists idx_routine_steps_routine_id on public.routine_steps(routine_id);

create trigger set_routine_steps_updated_at
before update on public.routine_steps
for each row execute function public.set_updated_at();

-- Habits
create table if not exists public.habits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  frequency public.habit_frequency not null default 'daily',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_habits_user_id on public.habits(user_id);
create index if not exists idx_habits_user_active on public.habits(user_id, active);

create trigger set_habits_updated_at
before update on public.habits
for each row execute function public.set_updated_at();

-- Habit logs
create table if not exists public.habit_logs (
  id uuid primary key default gen_random_uuid(),
  habit_id uuid not null references public.habits(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (habit_id, date)
);

create index if not exists idx_habit_logs_user_date on public.habit_logs(user_id, date);
create index if not exists idx_habit_logs_habit_date on public.habit_logs(habit_id, date);

-- Routine step logs
create table if not exists public.routine_step_logs (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  routine_step_id uuid not null references public.routine_steps(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (routine_step_id, date)
);

create index if not exists idx_routine_step_logs_user_date on public.routine_step_logs(user_id, date);
create index if not exists idx_routine_step_logs_routine_date on public.routine_step_logs(routine_id, date);

-- Routine logs
create table if not exists public.routine_logs (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  completed_steps int not null default 0,
  total_steps int not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (routine_id, date)
);

create index if not exists idx_routine_logs_user_date on public.routine_logs(user_id, date);
create index if not exists idx_routine_logs_routine_date on public.routine_logs(routine_id, date);

-- Goals
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  target_value int,
  current_value int not null default 0,
  status public.goal_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_goals_user_id on public.goals(user_id);
create index if not exists idx_goals_user_status on public.goals(user_id, status);

create trigger set_goals_updated_at
before update on public.goals
for each row execute function public.set_updated_at();

-- Daily reviews
create table if not exists public.daily_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  what_went_well text,
  what_to_improve text,
  mood text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);

create index if not exists idx_daily_reviews_user_date on public.daily_reviews(user_id, date);

create trigger set_daily_reviews_updated_at
before update on public.daily_reviews
for each row execute function public.set_updated_at();

-- Reminders
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type public.reminder_type not null,
  time time not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_reminders_user_enabled on public.reminders(user_id, enabled);

create trigger set_reminders_updated_at
before update on public.reminders
for each row execute function public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.routines enable row level security;
alter table public.routine_steps enable row level security;
alter table public.habits enable row level security;
alter table public.habit_logs enable row level security;
alter table public.routine_logs enable row level security;
alter table public.goals enable row level security;
alter table public.daily_reviews enable row level security;
alter table public.reminders enable row level security;

-- Policies: users only access their own rows
create policy "profiles_select_own" on public.profiles for select using (auth.uid() = user_id);
create policy "profiles_insert_own" on public.profiles for insert with check (auth.uid() = user_id);
create policy "profiles_update_own" on public.profiles for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profiles_delete_own" on public.profiles for delete using (auth.uid() = user_id);

create policy "routines_select_own" on public.routines for select using (auth.uid() = user_id);
create policy "routines_insert_own" on public.routines for insert with check (auth.uid() = user_id);
create policy "routines_update_own" on public.routines for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "routines_delete_own" on public.routines for delete using (auth.uid() = user_id);

create policy "routine_steps_select_own" on public.routine_steps for select using (
  exists (select 1 from public.routines r where r.id = routine_id and r.user_id = auth.uid())
);
create policy "routine_steps_insert_own" on public.routine_steps for insert with check (
  exists (select 1 from public.routines r where r.id = routine_id and r.user_id = auth.uid())
);
create policy "routine_steps_update_own" on public.routine_steps for update using (
  exists (select 1 from public.routines r where r.id = routine_id and r.user_id = auth.uid())
) with check (
  exists (select 1 from public.routines r where r.id = routine_id and r.user_id = auth.uid())
);
create policy "routine_steps_delete_own" on public.routine_steps for delete using (
  exists (select 1 from public.routines r where r.id = routine_id and r.user_id = auth.uid())
);

create policy "habits_select_own" on public.habits for select using (auth.uid() = user_id);
create policy "habits_insert_own" on public.habits for insert with check (auth.uid() = user_id);
create policy "habits_update_own" on public.habits for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "habits_delete_own" on public.habits for delete using (auth.uid() = user_id);

create policy "habit_logs_select_own" on public.habit_logs for select using (auth.uid() = user_id);
create policy "habit_logs_insert_own" on public.habit_logs for insert with check (auth.uid() = user_id);
create policy "habit_logs_update_own" on public.habit_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "habit_logs_delete_own" on public.habit_logs for delete using (auth.uid() = user_id);

create policy "routine_step_logs_select_own" on public.routine_step_logs for select using (auth.uid() = user_id);
create policy "routine_step_logs_insert_own" on public.routine_step_logs for insert with check (auth.uid() = user_id);
create policy "routine_step_logs_update_own" on public.routine_step_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "routine_step_logs_delete_own" on public.routine_step_logs for delete using (auth.uid() = user_id);

create policy "routine_logs_select_own" on public.routine_logs for select using (auth.uid() = user_id);
create policy "routine_logs_insert_own" on public.routine_logs for insert with check (auth.uid() = user_id);
create policy "routine_logs_update_own" on public.routine_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "routine_logs_delete_own" on public.routine_logs for delete using (auth.uid() = user_id);

create policy "goals_select_own" on public.goals for select using (auth.uid() = user_id);
create policy "goals_insert_own" on public.goals for insert with check (auth.uid() = user_id);
create policy "goals_update_own" on public.goals for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "goals_delete_own" on public.goals for delete using (auth.uid() = user_id);

create policy "daily_reviews_select_own" on public.daily_reviews for select using (auth.uid() = user_id);
create policy "daily_reviews_insert_own" on public.daily_reviews for insert with check (auth.uid() = user_id);
create policy "daily_reviews_update_own" on public.daily_reviews for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "daily_reviews_delete_own" on public.daily_reviews for delete using (auth.uid() = user_id);

create policy "reminders_select_own" on public.reminders for select using (auth.uid() = user_id);
create policy "reminders_insert_own" on public.reminders for insert with check (auth.uid() = user_id);
create policy "reminders_update_own" on public.reminders for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "reminders_delete_own" on public.reminders for delete using (auth.uid() = user_id);
