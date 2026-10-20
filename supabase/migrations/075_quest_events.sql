-- Quest events: staff pick a set of quests (or all of them), members join,
-- and completions during the event score points. Completions come from
-- WikiSync (the RuneLite plugin that sends quest progress to the OSRS Wiki
-- on logout) compared against each player's starting snapshot, or from a
-- screenshot that staff approve. Solo or team events.
--
-- RLS on with no policies: everything goes through the site's API with the
-- service role.

create table quest_events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  rules text,
  banner_url text,
  starts_at timestamptz,
  ends_at timestamptz,
  -- draft: staff only. signups: listed, members can join. active: live.
  -- completed: final standings.
  status text not null default 'draft' check (status in ('draft', 'signups', 'active', 'completed')),
  format text not null default 'solo' check (format in ('solo', 'teams')),
  -- difficulty: points per difficulty (difficulty_points); qp: the quest's
  -- quest points; flat: flat_points for every quest.
  scoring text not null default 'difficulty' check (scoring in ('difficulty', 'qp', 'flat')),
  difficulty_points jsonb not null default '{"Novice":1,"Intermediate":2,"Experienced":3,"Master":4,"Grandmaster":5,"Special":2}',
  flat_points int not null default 1 check (flat_points >= 0),
  -- Quests that count, by WikiSync name. Empty means every quest.
  quest_names text[] not null default '{}',
  include_miniquests boolean not null default false,
  last_synced_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table quest_event_teams (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references quest_events(id) on delete cascade,
  name text not null,
  color text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index quest_event_teams_event_idx on quest_event_teams(event_id);

create table quest_event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references quest_events(id) on delete cascade,
  user_id uuid references user_profiles(id) on delete set null,
  rsn text not null,
  team_id uuid references quest_event_teams(id) on delete set null,
  is_captain boolean not null default false,
  -- Quest name -> WikiSync status (0 not started, 1 started, 2 done) when
  -- the event started for this player; quests done here don't count.
  -- Null until WikiSync has been seen for them during the event.
  baseline jsonb,
  baseline_at timestamptz,
  -- Whether WikiSync had data for them last time we looked (null: not checked).
  has_wikisync boolean,
  quests_done int,
  last_checked_at timestamptz,
  joined_at timestamptz not null default now(),
  unique (event_id, rsn)
);
create index quest_event_participants_event_idx on quest_event_participants(event_id);

-- One row per quest a participant finished during the event.
create table quest_event_completions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references quest_events(id) on delete cascade,
  participant_id uuid not null references quest_event_participants(id) on delete cascade,
  quest_name text not null,
  source text not null check (source in ('wikisync', 'proof', 'staff')),
  completed_at timestamptz not null default now(),
  unique (participant_id, quest_name)
);
create index quest_event_completions_event_idx on quest_event_completions(event_id);

create table quest_event_submissions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references quest_events(id) on delete cascade,
  participant_id uuid not null references quest_event_participants(id) on delete cascade,
  quest_name text not null,
  image_urls text[] not null default '{}',
  note text,
  source text not null default 'web' check (source in ('web', 'discord')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewed_by text,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now()
);
create index quest_event_submissions_status_idx on quest_event_submissions(status, created_at);

create table quest_event_activity (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references quest_events(id) on delete cascade,
  participant_id uuid references quest_event_participants(id) on delete cascade,
  quest_name text,
  kind text not null check (kind in ('completed', 'submitted', 'rejected', 'joined')),
  created_at timestamptz not null default now()
);
create index quest_event_activity_event_idx on quest_event_activity(event_id, created_at desc);

alter table quest_events enable row level security;
alter table quest_event_teams enable row level security;
alter table quest_event_participants enable row level security;
alter table quest_event_completions enable row level security;
alter table quest_event_submissions enable row level security;
alter table quest_event_activity enable row level security;

-- Staff permission for running quest events (granted to the roles that can
-- already manage bingo).
insert into role_permissions (role, permission, granted)
select role, 'manage_quests', granted from role_permissions where permission = 'manage_bingo'
on conflict do nothing;
