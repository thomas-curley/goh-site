-- Rank Structure and Clan Rules pages (under the Clan menu), each shown as
-- uploaded page images (or a PDF converted to images), the same way as the
-- newsletter. Until a page has uploads, the site shows a built-in fallback:
-- the rank list from the About page, and the rules from the old handbook.
create table if not exists clan_pages (
  slug text primary key check (slug in ('rank-structure', 'clan-rules')),
  page_urls text[] not null default '{}',
  pdf_url text,
  updated_by text,
  updated_at timestamptz not null default now()
);

-- No policies: the public pages read through the service role, and edits
-- go through the admin API, gated by manage_clan_pages.
alter table clan_pages enable row level security;

-- Start the new permission off with the ranks that can already publish the
-- newsletter; adjust under Admin > Roles & Access.
insert into role_permissions (role, permission, granted)
select role, 'manage_clan_pages', true
from role_permissions
where permission = 'manage_newsletter' and granted
on conflict do nothing;
