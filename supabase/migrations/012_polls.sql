-- Clan votes via native Discord polls. Voting happens in Discord itself
-- (message poll object); this table just tracks what we posted and where,
-- so results can be fetched live and rendered in the admin panel.

create table if not exists polls (
  id uuid primary key default gen_random_uuid(),
  question text not null,
  options jsonb not null default '[]', -- [{ answer_id: number, text: string }]
  channel_id text not null,
  discord_message_id text not null,
  allow_multiselect boolean not null default false,
  duration_hours integer not null,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_polls_created on polls(created_at desc);

alter table polls enable row level security;

create policy "Authenticated users can manage polls"
  on polls for all
  using (auth.role() = 'authenticated');
