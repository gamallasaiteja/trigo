-- Mitdo: proposed Supabase schema for cloud sync (NOT wired up yet).
-- Mirrors src/models/types.ts. The app currently stores everything locally
-- through the DataRepository interface (src/storage/repository.ts); a
-- SupabaseRepository implementing that interface can use these tables.

create table if not exists categories (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  name text not null,
  emoji text not null,
  color text not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists task_series (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  title text not null,
  description text not null default '',
  category_id text not null references categories(id),
  start_date date not null,
  end_date date,
  scheduled_time time,
  reminder_offset_minutes int,
  repeat jsonb not null,               -- { frequency, days? }
  priority text not null default 'none',
  materialized_through date,
  skipped_dates date[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists tasks (
  id text primary key,
  user_id uuid not null references auth.users on delete cascade,
  series_id text references task_series(id) on delete set null,
  title text not null,
  description text not null default '',
  category_id text not null references categories(id),
  due_date date not null,
  original_date date not null,
  scheduled_time time,
  reminder_offset_minutes int,
  repeat jsonb not null,
  priority text not null default 'none',
  status text not null check (status in ('todo', 'in_progress', 'completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  snoozed_until timestamptz,
  history jsonb not null default '[]'  -- TaskEvent[]
);
create unique index if not exists tasks_series_occurrence on tasks (series_id, original_date) where series_id is not null;
create index if not exists tasks_user_due on tasks (user_id, due_date);

create table if not exists settings (
  user_id uuid primary key references auth.users on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table categories enable row level security;
alter table task_series enable row level security;
alter table tasks enable row level security;
alter table settings enable row level security;
create policy "own categories" on categories for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own series" on task_series for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own tasks" on tasks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own settings" on settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
