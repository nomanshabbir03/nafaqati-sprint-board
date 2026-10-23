-- Nafaqati Sprint Board: run once in the Supabase SQL editor.
-- Reads are public (the board is view-only for anyone with the link).
-- Writes happen only through the Vercel API using the service role key, after the edit key is checked.

create table if not exists public.board_settings (
  id int primary key default 1 check (id = 1),
  title text not null default 'Sprint Board',
  subtitle text not null default '',
  range_start date not null default current_date,
  range_end date not null default (current_date + 6),
  off_days int[] not null default '{0}'
);

create table if not exists public.tasks (
  id bigint generated always as identity primary key,
  title text not null check (char_length(title) between 1 and 160),
  notes text not null default '' check (char_length(notes) <= 2000),
  status text not null default 'todo' check (status in ('backlog', 'todo', 'doing', 'review', 'done')),
  area text not null default 'data' check (area in ('data', 'model', 'sync', 'dash', 'qa')),
  priority text not null default 'med' check (priority in ('high', 'med', 'low')),
  start_date date,
  end_date date,
  assignee text not null default '' check (char_length(assignee) <= 60),
  position double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tasks_status_position_idx on public.tasks (status, position);
create index if not exists tasks_start_idx on public.tasks (start_date);

alter table public.board_settings enable row level security;
alter table public.tasks enable row level security;

drop policy if exists "board_settings are readable by everyone" on public.board_settings;
create policy "board_settings are readable by everyone" on public.board_settings for select to anon, authenticated using (true);

drop policy if exists "tasks are readable by everyone" on public.tasks;
create policy "tasks are readable by everyone" on public.tasks for select to anon, authenticated using (true);

-- live updates in the browser
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tasks') then
    alter publication supabase_realtime add table public.tasks;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'board_settings') then
    alter publication supabase_realtime add table public.board_settings;
  end if;
end $$;
