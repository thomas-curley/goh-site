-- Single-row config (Postgres "one row" pattern: fixed id=1) tracking the
-- current (just-finished, being announced) and next (admin-queued) weekly
-- SOTW/BotW competition for the automated Sunday announcement cron.
create table if not exists weekly_competition_config (
  id integer primary key default 1 check (id = 1),

  current_competition_ids integer[] not null default '{}',
  current_competition_type text check (current_competition_type in ('sotw', 'botw')),
  current_competition_name text,
  current_week_start_date date,

  next_competition_ids integer[] not null default '{}',
  next_competition_type text check (next_competition_type in ('sotw', 'botw')),
  next_competition_name text,

  last_run_at timestamptz,
  updated_at timestamptz not null default now()
);

insert into weekly_competition_config (id) values (1) on conflict (id) do nothing;

alter table weekly_competition_config enable row level security;

create policy "Authenticated users can manage weekly competition config"
  on weekly_competition_config for all
  using (auth.role() = 'authenticated');
