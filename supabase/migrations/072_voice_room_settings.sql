-- Settings for the Discord bot's /create-room temporary voice rooms, edited
-- in Admin › Voice Rooms and read by the bot through /api/bot/voice-rooms.
-- Single-row table (id = 1), like plugin_settings.
create table if not exists voice_room_settings (
  id smallint primary key default 1 check (id = 1),
  enabled boolean not null default true,
  -- Discord category new rooms go in; null = a category named "Temp Rooms".
  category_id text,
  -- {name} is replaced by the creator's server nickname.
  name_template text not null default '🔇 {name}''s room',
  default_max_people integer not null default 10,
  max_room_size integer not null default 99,
  -- Discord role ids allowed to create rooms; empty = everyone.
  creator_role_ids text[] not null default '{}',
  -- Discord role ids that can always speak and manage any room; empty =
  -- roles named Oak, Pine, Yew, Council Member or Owner.
  staff_role_ids text[] not null default '{}',
  rooms_per_person integer not null default 1,
  cleanup_minutes integer not null default 30,
  -- Also delete a room the moment its last person leaves.
  delete_when_empty boolean not null default false,
  -- How old an empty room must be before it's removed.
  empty_grace_minutes integer not null default 5,
  -- Channel to log rooms being created and closed; null = no log.
  log_channel_id text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

insert into voice_room_settings (id) values (1) on conflict (id) do nothing;

-- No policies: read and written only through server routes (service role).
alter table voice_room_settings enable row level security;
