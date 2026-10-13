-- Member profiles (beta): a "logs"-style page per member with their outfit
-- shown in a Worn Equipment panel and every boss/skill coloured by where
-- they rank in the clan.

-- Every clan member's standing in every skill, boss and EHP/EHB, refreshed
-- daily from Wise Old Man's group hiscores (one call per metric), so a
-- profile can show "3rd of 24" without ~80 live API calls per page view.
create table if not exists clan_metric_rankings (
  metric text not null,
  metric_type text not null check (metric_type in ('skill', 'boss', 'computed')),
  -- normalizeRsn(display name): lowercase, single spaces.
  rsn_key text not null,
  display_name text not null,
  -- XP for skills, kill count for bosses, hours for EHP/EHB.
  value numeric not null,
  level integer,
  clan_rank integer not null,
  -- How many clan members have any progress in this metric.
  ranked_count integer not null,
  captured_at timestamptz not null default now(),
  primary key (metric, rsn_key)
);

create index if not exists idx_clan_metric_rankings_rsn on clan_metric_rankings (rsn_key);

-- Each member's 3D character. items: gear by equipment slot,
-- { "head": { "id": 9472, "name": "Gnome goggles" }, ... }; look: body type,
-- body-part styles and colours (null = use the clan default). Empty gear
-- slots fall back to the clan default.
create table if not exists profile_outfits (
  user_id uuid primary key references user_profiles(id) on delete cascade,
  items jsonb not null default '{}',
  look jsonb,
  updated_at timestamptz not null default now()
);

-- Small key/value store for profile-wide settings; 'default_character'
-- holds the clan's gnome fashionscape as { look, gear }.
create table if not exists profile_settings (
  key text primary key,
  value jsonb not null default '{}',
  updated_at timestamptz not null default now()
);

-- No policies on any of these: reads and writes go through server routes
-- using the service role.
alter table clan_metric_rankings enable row level security;
alter table profile_outfits enable row level security;
alter table profile_settings enable row level security;
