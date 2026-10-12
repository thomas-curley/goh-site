-- Staff Handbook as uploaded pages: the handbook is laid out outside the
-- site (as PNG pages or a PDF) and uploaded here, the same way as the
-- newsletter, replacing the per-section text editor (handbook_sections is
-- left in place, untouched, and is still shown until an edition is
-- published).
--
-- Each upload is an "edition"; the one most recently published is the
-- current handbook, and earlier published editions stay readable.
create table if not exists handbook_editions (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Staff Handbook',
  -- e.g. "v2.1" or "October 2026", shown next to the title.
  version_label text,
  -- Short "what changed" note for staff.
  notes text,
  -- Object paths in the private `handbook` storage bucket, in page order.
  page_paths text[] not null default '{}',
  pdf_path text,
  -- Table of contents: [{ "title": "Discipline", "page": 12 }, ...]
  contents jsonb not null default '[]',
  visibility text not null default 'staff' check (visibility in ('anonymous', 'verified_player', 'clan_member', 'staff')),
  is_published boolean not null default false,
  published_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_handbook_editions_published on handbook_editions (is_published, published_at desc);

-- No policies: every read and write goes through server routes using the
-- service role, which check the viewer's rank first.
alter table handbook_editions enable row level security;

-- Private bucket: page images are only reachable through short-lived
-- signed URLs handed out to viewers who pass the visibility check, and
-- uploads go through signed upload URLs issued to manage_handbook holders.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('handbook', 'handbook', false, 52428800, array['image/png', 'image/jpeg', 'image/webp', 'application/pdf'])
on conflict (id) do nothing;
