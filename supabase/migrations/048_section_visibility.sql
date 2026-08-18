-- Replaces site_sections' single staff_only boolean with a full role grid,
-- same shape as role_permissions. Absence of a row = visible (fails open,
-- so registering a new section never silently locks anyone out).
create table if not exists section_visibility (
  id uuid primary key default gen_random_uuid(),
  role text not null,          -- a RANKS key, or 'guest'
  section_key text not null,
  visible boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (role, section_key)
);
alter table section_visibility enable row level security;
create policy "Authenticated users can manage section visibility" on section_visibility for all using (auth.role() = 'authenticated');

-- Carry over the one real restriction that already existed: Bank stays
-- hidden from everyone except Oak and above (mirrors the old staff_only=true
-- seed), and Staff Handbook keeps its existing staff-only gate now expressed
-- the same way instead of a separate hardcoded check.
insert into section_visibility (role, section_key, visible) values
  ('guest', 'bank', false), ('gnome_child', 'bank', false),
  ('guest', 'staff_handbook', false), ('gnome_child', 'staff_handbook', false)
on conflict (role, section_key) do nothing;

drop table if exists site_sections;
