create table if not exists custom_commands (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  name text not null,
  description text not null default '',
  spec jsonb not null default '{}',
  enabled boolean not null default true,
  created_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(guild_id, name)
);

create index if not exists idx_custom_commands_guild on custom_commands(guild_id);

alter table custom_commands enable row level security;

create policy "Authenticated users can manage custom commands"
  on custom_commands for all
  using (auth.role() = 'authenticated');
