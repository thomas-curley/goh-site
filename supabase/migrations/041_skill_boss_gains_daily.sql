-- Clan-wide (not per-member) daily totals of XP/KC gained per skill/boss,
-- captured once a day by the existing snapshot cron -- Wise Old Man has no
-- single call that returns every metric for the whole group at once, so
-- this is populated by ~79 getGroupGains calls (one per skill/boss) each
-- run, not computed live on page load. Summing a date range's rows is how
-- the Player Activity dashboard answers "what has the clan been grinding
-- this week/month."
create table if not exists skill_boss_gains_daily (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  metric text not null,
  metric_type text not null check (metric_type in ('skill', 'boss')),
  total_gained bigint not null default 0,
  created_at timestamptz not null default now(),
  unique (date, metric)
);

create index if not exists idx_skill_boss_gains_daily_date on skill_boss_gains_daily(date);

alter table skill_boss_gains_daily enable row level security;
create policy "Authenticated users can manage skill boss gains" on skill_boss_gains_daily for all using (auth.role() = 'authenticated');
