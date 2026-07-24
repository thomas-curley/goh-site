-- Discord represents a recurring/series scheduled event as a SINGLE object
-- that keeps the same id forever -- Discord itself advances its
-- scheduled_start_time to the next occurrence once the current one passes,
-- and there is no API to list past/future occurrences separately. That
-- means importing a recurring series correctly requires one site `events`
-- row per occurrence, all sharing the same discord_event_id, discovered
-- incrementally as the daily import cron polls and sees the start time
-- move forward. The old single-column unique constraint made that
-- impossible (only the first-ever occurrence could ever be imported).
--
-- Swap it for a composite constraint on (discord_event_id, start_time):
-- still prevents true duplicate imports of the same occurrence, while
-- allowing multiple occurrences of the same series. NULL discord_event_id
-- (every event not imported from Discord) is unaffected -- Postgres never
-- treats NULLs as equal to each other in a unique constraint, same as
-- today.
alter table events drop constraint events_discord_event_id_key;
alter table events add constraint events_discord_event_id_start_time_key unique (discord_event_id, start_time);
