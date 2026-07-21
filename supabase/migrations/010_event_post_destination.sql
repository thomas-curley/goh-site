-- Events can now be posted to an admin-chosen channel/thread (like event
-- recaps already could) instead of only the fixed DISCORD_EVENTS_CHANNEL_ID
-- env var. Nullable: null means "used the env var default", which covers
-- every event created before this column existed.
alter table events add column if not exists discord_channel_id text;
