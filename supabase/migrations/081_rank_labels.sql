-- Custom display names (and descriptions) for each clan rank, set in
-- Admin › Settings › Rank Labels. A blank label falls back to the rank's
-- standard name (Gold Key, Silver Key, ...). RLS on, no policies: read by
-- the site with the service role.
create table rank_labels (
  rank_key text primary key,
  label text,
  description text,
  updated_at timestamptz not null default now()
);
alter table rank_labels enable row level security;
