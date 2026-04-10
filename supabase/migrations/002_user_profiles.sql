-- User profiles table for Discord-RSN linking
create table if not exists user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  discord_id text unique not null,
  discord_username text not null,
  discord_avatar text,
  rsn text,
  rsn_verified boolean default false,
  clan_rank text,
  linked_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Index for bot lookups by discord_id and rsn
create index if not exists idx_user_profiles_discord_id on user_profiles(discord_id);
create index if not exists idx_user_profiles_rsn on user_profiles(rsn);

-- Row Level Security
alter table user_profiles enable row level security;

-- Users can read their own profile
create policy "Users can view own profile"
  on user_profiles for select
  using (auth.uid() = id);

-- Users can update their own profile
create policy "Users can update own profile"
  on user_profiles for update
  using (auth.uid() = id);

-- Users can insert their own profile
create policy "Users can insert own profile"
  on user_profiles for insert
  with check (auth.uid() = id);

-- Service role can read all profiles (for bot API)
-- (Service role bypasses RLS by default)
