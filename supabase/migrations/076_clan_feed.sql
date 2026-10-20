-- Clan feed: the Discord bot reads chosen channels where DropTracker (or a
-- clan-chat forwarder) posts drops, collection log items and quest
-- completions, and the site uses them to tick bingo item tiles and count
-- quest event quests automatically -- for players who don't use WikiSync or
-- Discord themselves.
--
-- RLS on with no policies: the bot and admin pages go through the API.

create table clan_feed_channels (
  channel_id text primary key,
  label text,
  created_at timestamptz not null default now()
);

-- Every message read from a feed channel, what was understood from it and
-- what it counted for. Kept for 30 days so staff can see why something did
-- (or didn't) count.
create table clan_feed_messages (
  id uuid primary key default gen_random_uuid(),
  discord_message_id text not null unique,
  channel_id text not null,
  author_name text,
  posted_at timestamptz not null,
  text text not null default '',
  image_urls text[] not null default '{}',
  events jsonb not null default '[]',
  outcomes jsonb not null default '[]',
  created_at timestamptz not null default now()
);
create index clan_feed_messages_posted_idx on clan_feed_messages(posted_at desc);

alter table clan_feed_channels enable row level security;
alter table clan_feed_messages enable row level security;

-- A quest counted from the feed, and a bingo drop sent in by the feed.
alter table quest_event_completions drop constraint quest_event_completions_source_check;
alter table quest_event_completions add constraint quest_event_completions_source_check check (source in ('wikisync', 'proof', 'staff', 'broadcast'));
alter table bingo_submissions drop constraint bingo_submissions_source_check;
alter table bingo_submissions add constraint bingo_submissions_source_check check (source in ('web', 'discord', 'feed'));

-- Per bingo: what to do with a matching drop from the feed.
--   approve: count it straight away   review: queue it for staff   off: ignore
alter table bingo_events add column feed_mode text not null default 'approve' check (feed_mode in ('off', 'review', 'approve'));
