-- Bingo v2: scoring (tile points, line and blackout bonuses), count tiles,
-- item groups, several submissions per tile, sign-ups and an activity feed.
-- Auto-tracked tiles now read Wise Old Man group gains for the event's
-- dates instead of creating one WOM competition per tile.
--
-- The v1 tables (049) never held an event, so they're rebuilt rather than
-- altered. This also drops 049's "any signed-in user can write" policies:
-- every read and write goes through the site's API with the service role.

drop table if exists bingo_tile_completions cascade;
drop table if exists bingo_tiles cascade;
drop table if exists bingo_team_members cascade;
drop table if exists bingo_teams cascade;
drop table if exists bingo_events cascade;

create table bingo_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  rules text,
  banner_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  grid_size int not null default 5 check (grid_size between 3 and 7),
  -- draft: staff only. signups: listed, members can join, board hidden.
  -- active: board live. completed: final standings.
  status text not null default 'draft' check (status in ('draft', 'signups', 'active', 'completed')),
  win_rule text not null default 'points' check (win_rule in ('points', 'blackout')),
  line_bonus int not null default 5 check (line_bonus >= 0),
  blackout_bonus int not null default 10 check (blackout_bonus >= 0),
  hide_other_teams boolean not null default false,
  last_synced_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table bingo_teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references bingo_events(id) on delete cascade,
  name text not null,
  color text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index bingo_teams_event_idx on bingo_teams(event_id);

-- RSN-first roster so staff can add anyone from the clan list, linked
-- account or not.
create table bingo_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references bingo_teams(id) on delete cascade,
  event_id uuid not null references bingo_events(id) on delete cascade,
  rsn text not null,
  is_captain boolean not null default false,
  created_at timestamptz not null default now(),
  unique (event_id, rsn)
);
create index bingo_team_members_team_idx on bingo_team_members(team_id);

-- Tiles exist only for filled squares, so a draft board can be half done.
create table bingo_tiles (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references bingo_events(id) on delete cascade,
  position int not null check (position >= 0),
  title text not null,
  description text,
  points int not null default 1 check (points >= 0),
  -- icon_kind: item (icon_ref = item name, icon_item_id optional),
  -- metric (icon_ref = WOM metric key) or none.
  icon_kind text not null default 'none' check (icon_kind in ('none', 'item', 'metric')),
  icon_ref text,
  icon_item_id int,
  -- proof: screenshots reviewed by staff, each approved one adds its
  -- quantity until required_count. auto: WOM gains of `metric`.
  kind text not null check (kind in ('proof', 'auto')),
  required_count int not null default 1 check (required_count >= 1),
  -- For "any of these items" tiles; shown to players, not enforced.
  accepted_items text[] not null default '{}',
  metric text,
  target numeric,
  auto_mode text not null default 'team_total' check (auto_mode in ('team_total', 'single_player')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id, position),
  check (kind <> 'auto' or (metric is not null and target is not null and target > 0))
);

create table bingo_submissions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references bingo_events(id) on delete cascade,
  tile_id uuid not null references bingo_tiles(id) on delete cascade,
  team_id uuid not null references bingo_teams(id) on delete cascade,
  submitted_by uuid references user_profiles(id) on delete set null,
  submitter_rsn text not null,
  source text not null default 'web' check (source in ('web', 'discord')),
  image_urls text[] not null default '{}',
  quantity int not null default 1 check (quantity >= 1),
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);
create index bingo_submissions_status_idx on bingo_submissions(status, created_at);
create index bingo_submissions_tile_team_idx on bingo_submissions(tile_id, team_id);

-- One row per (tile, team): current progress, kept up to date by reviews
-- (proof tiles) and the WOM sync (auto tiles). `contributors` maps RSN to
-- that player's share of the progress.
create table bingo_progress (
  tile_id uuid not null references bingo_tiles(id) on delete cascade,
  team_id uuid not null references bingo_teams(id) on delete cascade,
  event_id uuid not null references bingo_events(id) on delete cascade,
  progress numeric not null default 0,
  contributors jsonb not null default '{}',
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (tile_id, team_id)
);
create index bingo_progress_event_idx on bingo_progress(event_id);

create table bingo_signups (
  event_id uuid not null references bingo_events(id) on delete cascade,
  user_id uuid not null references user_profiles(id) on delete cascade,
  rsn text not null,
  note text,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table bingo_activity (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references bingo_events(id) on delete cascade,
  team_id uuid references bingo_teams(id) on delete cascade,
  tile_id uuid references bingo_tiles(id) on delete set null,
  kind text not null check (kind in ('tile', 'line', 'blackout', 'submitted', 'rejected')),
  rsn text,
  points int not null default 0,
  message text not null,
  created_at timestamptz not null default now()
);
create index bingo_activity_event_idx on bingo_activity(event_id, created_at desc);

alter table bingo_events enable row level security;
alter table bingo_teams enable row level security;
alter table bingo_team_members enable row level security;
alter table bingo_tiles enable row level security;
alter table bingo_submissions enable row level security;
alter table bingo_progress enable row level security;
alter table bingo_signups enable row level security;
alter table bingo_activity enable row level security;
