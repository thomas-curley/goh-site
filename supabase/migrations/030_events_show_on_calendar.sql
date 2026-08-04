-- Lets a "text-only" event post skip the site's public calendar entirely --
-- e.g. a one-off activity under an already-recurring event (Social Tuesday)
-- that doesn't need its own duplicate calendar entry.
alter table events add column if not exists show_on_calendar boolean not null default true;
