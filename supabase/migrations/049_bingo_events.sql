-- Bingo Events: admin-built team bingo boards. Tiles track completion either
-- automatically (linked to a WOM team competition) or manually (a team
-- submits a screenshot for admin review) -- see bingo_tile_completions,
-- which is the single source of truth per (tile, team) for both cases.
create table if not exists bingo_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  banner_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  grid_size int not null default 5,
  status text not null default 'draft' check (status in ('draft', 'active', 'completed')),
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists bingo_teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references bingo_events(id) on delete cascade,
  name text not null,
  color text,
  created_at timestamptz not null default now()
);

-- RSN-first roster (mirrors wom_competitions.teams) so an admin can build a
-- team from the clan roster without every member having a site account yet;
-- user_id backfills once/if that RSN's owner links one.
create table if not exists bingo_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references bingo_teams(id) on delete cascade,
  rsn text not null,
  user_id uuid references user_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (team_id, rsn)
);

create table if not exists bingo_tiles (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references bingo_events(id) on delete cascade,
  position int not null,
  task_title text not null,
  task_description text,
  tracking_type text not null check (tracking_type in ('wom', 'manual')),
  wom_competition_id uuid references wom_competitions(id) on delete set null,
  wom_target_value numeric,
  created_at timestamptz not null default now(),
  unique (event_id, position)
);

-- One row per (tile, team): the single source of truth for that team's
-- progress, for both tracking types. wom_progress_value/status are
-- overwritten by the daily sync cron or the admin "Refresh Now" action for
-- wom tiles; submitted_by through review_notes are only ever populated for
-- manual tiles.
create table if not exists bingo_tile_completions (
  id uuid primary key default gen_random_uuid(),
  tile_id uuid not null references bingo_tiles(id) on delete cascade,
  team_id uuid not null references bingo_teams(id) on delete cascade,
  status text not null default 'incomplete' check (status in ('incomplete', 'pending_review', 'completed')),
  wom_progress_value numeric,
  image_urls text[],
  submitted_by uuid references user_profiles(id),
  submitted_at timestamptz,
  reviewed_by text,
  reviewed_at timestamptz,
  review_notes text,
  updated_at timestamptz not null default now(),
  unique (tile_id, team_id)
);

alter table bingo_events enable row level security;
alter table bingo_teams enable row level security;
alter table bingo_team_members enable row level security;
alter table bingo_tiles enable row level security;
alter table bingo_tile_completions enable row level security;

create policy "Authenticated users can manage bingo events" on bingo_events for all using (auth.role() = 'authenticated');
create policy "Authenticated users can manage bingo teams" on bingo_teams for all using (auth.role() = 'authenticated');
create policy "Authenticated users can manage bingo team members" on bingo_team_members for all using (auth.role() = 'authenticated');
create policy "Authenticated users can manage bingo tiles" on bingo_tiles for all using (auth.role() = 'authenticated');
create policy "Authenticated users can manage bingo tile completions" on bingo_tile_completions for all using (auth.role() = 'authenticated');
