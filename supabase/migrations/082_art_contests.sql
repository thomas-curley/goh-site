-- Art contests: members submit artwork with their own privacy choices, staff
-- review entries against the rules and pick which go to the vote, the clan
-- votes (with optional comments), and pieces whose artists opt in go on
-- show in the public gallery afterwards.
--
-- RLS on with no policies: everything goes through the site's API with the
-- service role. Images live in the private `art` bucket and are only ever
-- shown through short-lived signed URLs, so "clan only" entries stay private.

create table art_contests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  rules text,
  theme text,
  banner_url text,
  -- draft: staff only. submissions: open for entries. review: entries
  -- closed, staff deciding. voting: approved entries open to the vote.
  -- completed: results out.
  status text not null default 'draft' check (status in ('draft', 'submissions', 'review', 'voting', 'completed')),
  submissions_close_at timestamptz,
  voting_close_at timestamptz,
  -- Who may enter: verified clan members, or anyone signed in with Discord.
  submit_eligibility text not null default 'clan' check (submit_eligibility in ('clan', 'signed_in')),
  max_entries_per_person int not null default 1 check (max_entries_per_person between 1 and 20),
  max_images_per_entry int not null default 3 check (max_images_per_entry between 1 and 10),
  -- Each voter picks up to this many different entries.
  votes_per_voter int not null default 1 check (votes_per_voter between 1 and 20),
  -- Who may vote: verified clan members, anyone signed in, or one ballot per IP.
  vote_eligibility text not null default 'clan' check (vote_eligibility in ('clan', 'signed_in', 'ip')),
  -- Vote counts during voting: hidden until the contest is finished, or live.
  show_live_results boolean not null default false,
  -- Voters' comments: 'live' on the entry straight away, 'after' voting ends,
  -- 'private' (staff and the artist only), or 'off'.
  comments_visibility text not null default 'after' check (comments_visibility in ('live', 'after', 'private', 'off')),
  -- Hide who made each entry while voting (credit is shown afterwards,
  -- as each artist chose).
  anonymous_voting boolean not null default true,
  last_reminder_at timestamptz,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table art_entries (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid references art_contests(id) on delete cascade,
  user_id uuid references user_profiles(id) on delete set null,
  -- The submitter's RSN when they entered (verified link, if they had one).
  rsn text,
  title text not null,
  description text,
  -- Paths in the private `art` bucket, in display order.
  image_paths text[] not null default '{}',
  -- Who can see it during and after the contest: anyone ('public'), or only
  -- signed-in clan members ('clan').
  visibility text not null default 'public' check (visibility in ('public', 'clan')),
  -- How the artist is credited: by RSN, by a name they choose, or not at all.
  credit text not null default 'rsn' check (credit in ('rsn', 'custom', 'anonymous')),
  credit_name text,
  -- Keep it in the public gallery after the contest.
  gallery_opt_in boolean not null default false,
  agreed_rules boolean not null default false,
  -- pending: waiting for staff. approved: goes to the vote. rejected: sent
  -- back with a note. withdrawn: removed by the artist.
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'withdrawn')),
  review_note text,
  reviewed_by text,
  reviewed_at timestamptz,
  -- Staff can hide a piece from the gallery without touching the contest.
  gallery_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index art_entries_contest_idx on art_entries(contest_id, status);
create index art_entries_gallery_idx on art_entries(gallery_opt_in, status) where gallery_opt_in;

create table art_votes (
  id uuid primary key default gen_random_uuid(),
  contest_id uuid not null references art_contests(id) on delete cascade,
  entry_id uuid not null references art_entries(id) on delete cascade,
  -- Who cast it: 'user:<uuid>' for signed-in voters, 'ip:<hash>' for
  -- per-IP contests. The raw IP is never stored, only a keyed hash.
  voter_key text not null,
  voter_user_id uuid references user_profiles(id) on delete set null,
  voter_name text,
  comment text,
  comment_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique (contest_id, voter_key, entry_id)
);
create index art_votes_contest_idx on art_votes(contest_id, voter_key);

alter table art_contests enable row level security;
alter table art_entries enable row level security;
alter table art_votes enable row level security;

-- Private bucket for the artwork (20 MB per image).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('art', 'art', false, 20971520, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

-- Staff permission for running art contests (granted to the roles that can
-- already run quest events).
insert into role_permissions (role, permission, granted)
select role, 'manage_art', granted from role_permissions where permission = 'manage_quests'
on conflict do nothing;
