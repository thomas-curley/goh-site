-- When2Meet-style scheduling grids. A poll's grid is defined by the admin
-- as a set of candidate days plus a daily time window, in clan-local time
-- (America/New_York) -- start_minute/end_minute are minutes-from-midnight
-- in that reference zone, converted to absolute UTC instants once at
-- creation time (see lib/availability.ts's zonedTimeToUtc/slotsForPoll).
-- Every other place in the app only ever displays those fixed instants in
-- whichever zone a viewer picks -- no further zone math needed anywhere
-- else.
create table if not exists availability_polls (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  days text[] not null,
  start_minute integer not null,
  end_minute integer not null,
  slot_minutes integer not null default 30,
  access_level text not null default 'anonymous' check (access_level in ('anonymous', 'verified_player', 'clan_member')),
  is_active boolean not null default true,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists availability_responses (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references availability_polls(id) on delete cascade,
  respondent_name text,
  discord_id text,
  timezone text not null,
  slots text[] not null,
  submitted_at timestamptz not null default now()
);

create index if not exists idx_availability_responses_poll on availability_responses(poll_id);

alter table availability_polls enable row level security;
alter table availability_responses enable row level security;

create policy "Authenticated users can manage availability polls"
  on availability_polls for all
  using (auth.role() = 'authenticated');

create policy "Authenticated users can manage availability responses"
  on availability_responses for all
  using (auth.role() = 'authenticated');
