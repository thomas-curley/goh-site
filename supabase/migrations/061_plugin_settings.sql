-- Clan-wide settings for the RuneLite companion plugin: the clan name and
-- colour theme every member's plugin renders with. RuneLite plugin config
-- is strictly per-user (there's no way for one member's settings to reach
-- another's client), so anything that should be the same for the whole clan
-- has to live here on the site and be fetched by each plugin -- the only
-- things a member configures locally are the site URL and their own API key.
--
-- Single-row table, same convention as payout_prize_defaults. clan_name is
-- nullable: null means "not set up yet", and the plugin API falls back to
-- the site's own CLAN_NAME constant, so an existing deployment keeps its
-- branding with zero setup while still prompting an owner to confirm it
-- (and pick a theme) the first time they open the plugin.
create table if not exists plugin_settings (
  id smallint primary key default 1 check (id = 1),
  clan_name text,
  theme text not null default 'moss',
  configured boolean not null default false,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

insert into plugin_settings (id) values (1) on conflict (id) do nothing;

alter table plugin_settings enable row level security;

create policy "Authenticated users can view plugin settings"
  on plugin_settings for select
  using (auth.role() = 'authenticated');

-- Owners can set the plugin up out of the box; everyone else needs an
-- explicit grant from /admin/permissions, same as every other permission.
insert into role_permissions (role, permission, granted)
values ('owner', 'manage_plugin_settings', true)
on conflict (role, permission) do nothing;
