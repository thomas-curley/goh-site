-- Events table for calendar sync with Discord
create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  event_type text not null default 'other',
  start_time timestamptz not null,
  end_time timestamptz,
  host_rsn text,
  world integer,
  location text,
  requirements text,
  prize_pool text,
  discord_event_id text unique,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- WOM API cache table
create table if not exists wom_cache (
  cache_key text primary key,
  data jsonb not null,
  fetched_at timestamptz default now(),
  ttl_seconds integer default 3600
);

-- Index for event queries
create index if not exists idx_events_start_time on events(start_time);
create index if not exists idx_events_event_type on events(event_type);
create index if not exists idx_wom_cache_fetched_at on wom_cache(fetched_at);
