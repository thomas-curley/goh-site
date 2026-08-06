-- Staff Handbook: admin-editable content pages, so higher-ups can update the
-- handbook without a code deploy. parent_slug lets a section have
-- subsections (e.g. "Events & Challenges" -> "4a. Types of Activities").
create table if not exists handbook_sections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  parent_slug text references handbook_sections(slug) on delete cascade on update cascade,
  order_index integer not null default 0,
  pull_quote text,
  content text not null default '',
  visibility text not null default 'clan_member' check (visibility in ('anonymous', 'verified_player', 'clan_member')),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_handbook_sections_parent_slug on handbook_sections(parent_slug);

alter table handbook_sections enable row level security;

create policy "Authenticated users can manage handbook sections" on handbook_sections
  for all using (auth.role() = 'authenticated');
