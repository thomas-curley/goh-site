-- Public shoutouts about a specific clan member, moderated before posting.
-- submitter_name left blank means anonymous, same convention as
-- feedback_submissions.respondent_name -- no separate boolean needed.
create table if not exists gnomie_reviews (
  id uuid primary key default gen_random_uuid(),
  target_rsn text not null,
  highlight_type text not null default 'shoutout' check (highlight_type in ('shoutout', 'helped_me_out', 'funny_moment', 'mvp')),
  message text not null,
  submitter_name text,
  image_urls text[] not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_notes text,
  reviewed_by text,
  reviewed_at timestamptz,
  discord_message_id text,
  discord_channel_id text,
  ip_address inet,
  created_at timestamptz not null default now()
);

create index if not exists idx_gnomie_reviews_status on gnomie_reviews(status);

alter table gnomie_reviews enable row level security;
create policy "Authenticated users can manage gnomie reviews" on gnomie_reviews for all using (auth.role() = 'authenticated');
