-- Tracks the actual channel an announcement's Discord message lives in,
-- mirroring events.discord_channel_id (010). Needed so that when the
-- destination turns out to be a forum channel and a new forum post is
-- created, later edits target the post's thread rather than re-resolving
-- the (now-wrong) forum channel id every time.
alter table announcements add column if not exists discord_channel_id text;
