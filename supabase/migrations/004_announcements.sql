create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  category text not null default 'announcement',
  pinned boolean default false,
  published boolean default true,
  author_id uuid references auth.users(id),
  author_name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_announcements_published on announcements(published, created_at desc);

alter table announcements enable row level security;

create policy "Anyone can read published announcements"
  on announcements for select
  using (published = true);
