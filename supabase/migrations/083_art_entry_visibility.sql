-- Who can see a contest's entries is now set by staff for the whole contest,
-- not picked by each artist. art_entries.visibility is kept in step with it.
alter table art_contests
  add column if not exists entry_visibility text not null default 'public'
  check (entry_visibility in ('public', 'clan'));

-- Contests that already have a clan-only entry stay clan-only, so nothing becomes more public
update art_contests c
set entry_visibility = 'clan'
where exists (select 1 from art_entries e where e.contest_id = c.id and e.visibility = 'clan');

update art_entries e
set visibility = c.entry_visibility
from art_contests c
where e.contest_id = c.id and e.visibility <> c.entry_visibility;
