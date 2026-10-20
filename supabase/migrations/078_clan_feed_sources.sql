-- When each polled clan feed source (the DropTracker API) was last read
-- successfully, and what that poll found, for the next poll's window and
-- the Clan Feed admin page. RLS on with no policies (service role only).
create table clan_feed_sources (
  source text primary key,
  last_polled_at timestamptz,
  last_result jsonb,
  updated_at timestamptz not null default now()
);
alter table clan_feed_sources enable row level security;
