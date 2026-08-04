-- IP ban list, initially for blocking spam on public survey responses.
-- Deliberately general-purpose (not survey_responses-specific) so any
-- other anonymous-submission feature (availability polls, feedback) can
-- check the same list later without a new table.
create table if not exists banned_ips (
  id uuid primary key default gen_random_uuid(),
  ip_address inet not null unique,
  reason text,
  banned_by text,
  created_at timestamptz not null default now()
);

alter table survey_responses add column if not exists ip_address inet;

alter table banned_ips enable row level security;

create policy "Authenticated users can manage banned ips"
  on banned_ips for all
  using (auth.role() = 'authenticated');
