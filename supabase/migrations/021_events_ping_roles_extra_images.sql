-- Events never actually persisted the ping roles / extra images chosen at
-- creation time -- they were only used once to build the initial Discord
-- post, then lost. This meant editing an event (and syncing the Discord
-- post) always wiped the ping and images, since the edit form had nothing
-- to load them from.
alter table events add column if not exists ping_roles text[] not null default '{}';
alter table events add column if not exists extra_images text[] not null default '{}';
