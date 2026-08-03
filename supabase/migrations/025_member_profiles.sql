-- Gn0meBook: Facebook-style member profile pages. Kept as its own table
-- rather than new columns on user_profiles (the sensitive auth/RSN-linking
-- table) -- one table per feature, matching every other addition this
-- session. `is_published` (is this page live at all) and `visibility`
-- (who's allowed to see it once it is -- reuses the same AccessLevel tiers
-- as Surveys/Availability Polls) are deliberately separate concerns.
create table if not exists member_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  tagline text,
  about text,
  interests text,
  play_schedule text,
  in_game_focus text,
  avatar_url text,
  banner_url text,
  social_links jsonb not null default '[]',
  is_published boolean not null default true,
  visibility text not null default 'anonymous' check (visibility in ('anonymous', 'verified_player', 'clan_member')),
  hidden_by_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table member_profiles enable row level security;

create policy "Authenticated users can manage member profiles"
  on member_profiles for all
  using (auth.role() = 'authenticated');
