-- Lets one account link additional RSNs as "alts" -- shown as metadata on
-- the account's one existing Gn0meBook profile (never their own profile),
-- and folded into permission resolution: whichever of the main RSN or any
-- alt carries the highest clan rank is what the site actually uses. See
-- lib/rank-resolution.ts for the resolution logic this backs.
--
-- clan_rank here is a cached WOM-group lookup taken when the alt is added,
-- same convention as user_profiles.clan_rank for the main RSN -- never
-- re-checked live on every request, just refreshed when the link changes.
create table if not exists user_alt_rsns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  rsn text not null,
  clan_rank text,
  linked_at timestamptz not null default now()
);

-- One claim site-wide per RSN, same as the uniqueness the main-RSN linking
-- flow already enforces via an ilike check against user_profiles.rsn --
-- this index enforces it for the alts table specifically; the API route
-- additionally checks against user_profiles.rsn so a name can't be claimed
-- as one person's main and another's alt at the same time.
create unique index if not exists idx_user_alt_rsns_rsn_unique on user_alt_rsns (lower(rsn));
create index if not exists idx_user_alt_rsns_user_id on user_alt_rsns(user_id);

alter table user_alt_rsns enable row level security;

create policy "Authenticated users can view alt rsns"
  on user_alt_rsns for select
  using (auth.role() = 'authenticated');
