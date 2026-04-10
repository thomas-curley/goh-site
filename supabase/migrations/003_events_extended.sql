-- Extended event fields to match Discord event format
alter table events add column if not exists meet_location text;
alter table events add column if not exists spots text default 'Open';
alter table events add column if not exists signup_type text default 'Open — just show up';
alter table events add column if not exists voice_channel text;
alter table events add column if not exists requirements_list text;
alter table events add column if not exists guide_text text;
alter table events add column if not exists video_url text;
alter table events add column if not exists discord_message_id text;
