-- Admin-togglable "is this section staff-only right now" overrides. Absence
-- of a row means "not staff-only" (safe default -- a new section is visible
-- to whatever access level its own page already checks, until an admin
-- explicitly restricts it here).
create table if not exists site_sections (
  key text primary key,
  staff_only boolean not null default false,
  updated_by text,
  updated_at timestamptz not null default now()
);
alter table site_sections enable row level security;
create policy "Authenticated users can manage site sections" on site_sections for all using (auth.role() = 'authenticated');

insert into site_sections (key, staff_only) values ('bank', true)
on conflict (key) do nothing;
