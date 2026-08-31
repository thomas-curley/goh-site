-- Phase 2A of the RuneLite plugin expansion: a real clan points system fed
-- by real-time plugin events, plus a per-player game-data summary row.

-- Per-player summary row, kept in sync by the plugin. Deliberately a summary
-- only -- when Combat Achievement/Collection Log/Diary/Quest sync lands in a
-- later phase, give each its own table FK'd to user_id rather than growing
-- this one with jsonb blobs.
create table if not exists player_game_data (
  user_id uuid primary key references user_profiles(id) on delete cascade,
  account_type text,
  combat_level integer,
  total_level integer,
  total_xp bigint,
  synced_at timestamptz not null default now()
);

-- Admin-configurable point values per event type. rule_key is a small,
-- code-known enum (see lib/clan-points.ts) seeded below -- the ingest route
-- always resolves points by looking this up server-side, never from the
-- plugin's request body.
create table if not exists clan_points_rules (
  rule_key text primary key,
  label text not null,
  points integer not null default 0,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into clan_points_rules (rule_key, label, points) values
  ('level_up', 'Skill level-up', 1),
  ('level_up_99', 'Reaching level 99', 25),
  ('quest_completion', 'Quest completed', 5),
  ('boss_kc_milestone', 'Boss KC milestone', 3),
  ('clue_easy', 'Easy clue completed', 1),
  ('clue_medium', 'Medium clue completed', 2),
  ('clue_hard', 'Hard clue completed', 3),
  ('clue_elite', 'Elite clue completed', 5),
  ('clue_master', 'Master clue completed', 8),
  ('pet_drop', 'Pet received', 10)
on conflict (rule_key) do nothing;

-- Append-only -- current balance = sum(points) per user. dedupe_key is
-- populated per event type (see lib/clan-points.ts) so a retried/replayed
-- plugin report can never double-award; source_type + rule_key are kept
-- separately (rule_key nullable) so a later manual adjustment can omit it.
create table if not exists clan_points_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  points integer not null,
  reason text not null,
  source_type text not null,
  rule_key text references clan_points_rules(rule_key) on delete set null,
  dedupe_key text not null,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_clan_points_ledger_dedupe
  on clan_points_ledger(user_id, source_type, dedupe_key);
create index if not exists idx_clan_points_ledger_user_id on clan_points_ledger(user_id);

alter table player_game_data enable row level security;
alter table clan_points_rules enable row level security;
alter table clan_points_ledger enable row level security;

create policy "Authenticated users can view player game data" on player_game_data for select using (auth.role() = 'authenticated');
create policy "Authenticated users can manage points rules" on clan_points_rules for all using (auth.role() = 'authenticated');
create policy "Authenticated users can view points ledger" on clan_points_ledger for select using (auth.role() = 'authenticated');
