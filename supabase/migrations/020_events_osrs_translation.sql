-- Fields for translating a site/Discord event into the values an admin
-- needs to manually type into OSRS's in-game "Clan Home: Events" creation
-- form (there's no API for that panel -- this is purely a bookkeeping
-- helper). Admin-only; never rendered on public pages.
alter table events add column if not exists osrs_type text;
alter table events add column if not exists osrs_subtype text;
alter table events add column if not exists osrs_activity text;
alter table events add column if not exists osrs_join_rank text;
alter table events add column if not exists osrs_duration_days integer;
alter table events add column if not exists osrs_added_ingame boolean not null default false;
