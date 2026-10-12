-- The Weekly Glider: the clan's weekly newsletter, made outside the site
-- (as PNG pages or a PDF) and uploaded here to be read at /newsletter.
-- Each issue is one or more page images, shown stacked in order; a PDF,
-- when uploaded, is converted to those images in the browser and also kept
-- as a download.
create table if not exists newsletters (
  id uuid primary key default gen_random_uuid(),
  issue_number integer not null unique check (issue_number > 0),
  title text not null default 'The Weekly Glider',
  -- One-line teaser shown in the archive and link previews.
  headline text,
  published_on date not null default current_date,
  page_urls text[] not null default '{}',
  pdf_url text,
  is_published boolean not null default false,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_newsletters_published on newsletters (is_published, issue_number desc);

alter table newsletters enable row level security;

-- Anyone can read published issues; all writes go through the admin API
-- (service role), gated by manage_newsletter.
create policy "Published newsletters are public"
  on newsletters for select
  using (is_published);

-- Start the new permission off with the ranks that already curate public
-- content (same as manage_testimonials); adjust under Admin > Roles & Access.
insert into role_permissions (role, permission, granted)
select role, 'manage_newsletter', true
from role_permissions
where permission = 'manage_testimonials' and granted
on conflict do nothing;
