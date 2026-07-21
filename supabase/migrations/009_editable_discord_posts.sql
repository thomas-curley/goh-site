-- Schema needed to edit Discord messages that were already posted:
-- announcements/events already post successfully but don't (fully) track
-- which message is theirs, and event recaps have no persistence at all.

-- Already live in Supabase (added out-of-band) but not declared in any
-- migration until now — idempotent, closes the drift, no-op against prod.
alter table announcements add column if not exists discord_message_id text unique;

-- The signup-thread starter message's id was fetched from Discord and then
-- discarded; never persisted. Needed to edit it later.
alter table events add column if not exists signup_thread_id text;
alter table events add column if not exists signup_thread_message_id text;

-- Event recaps currently post-and-forget with zero record in Supabase, so
-- there's nothing to look up to edit. destination_channel_id is NOT NULL —
-- unlike announcements/events, recaps have no fixed-channel env var
-- fallback; per-row tracking is the whole point.
create table if not exists event_recap_posts (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references events(id) on delete set null,
  title text not null,
  description text,
  highlights jsonb not null default '[]',
  winners jsonb not null default '[]',
  images jsonb not null default '[]',
  ping_roles jsonb not null default '[]',
  template_id uuid references post_templates(id) on delete set null,
  destination_channel_id text not null,
  discord_message_id text,
  author_name text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_event_recap_posts_created on event_recap_posts(created_at desc);

alter table event_recap_posts enable row level security;

-- Same trust model as post_templates/post_sections/custom_commands:
-- enforcement is the admin UI's checkPermission gate, not RLS.
create policy "Authenticated users can manage event recap posts"
  on event_recap_posts for all
  using (auth.role() = 'authenticated');
