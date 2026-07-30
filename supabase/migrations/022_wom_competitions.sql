-- Tracks Wise Old Man competitions created from this site's admin panel, so
-- they can be listed and deleted later. WOM only returns each competition's
-- verification code once, at creation time, and it's the only way (short of
-- the whole group's code) to edit/delete that specific competition -- so it
-- has to be persisted here. This table is never queried from the browser;
-- all access goes through app/api/admin/wom-competitions routes, which
-- deliberately omit verification_code from anything sent to the client.
create table if not exists wom_competitions (
  id uuid primary key default gen_random_uuid(),
  wom_id integer not null unique,
  title text not null,
  metric text not null,
  type text not null check (type in ('classic', 'team')),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  group_linked boolean not null default false,
  verification_code text not null,
  participants text[],
  teams jsonb,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table wom_competitions enable row level security;

create policy "Authenticated users can manage wom competitions"
  on wom_competitions for all
  using (auth.role() = 'authenticated');
