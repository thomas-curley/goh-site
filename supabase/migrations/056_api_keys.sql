-- Personal access tokens for the RuneLite companion plugin (Phase 1: private
-- test build, not yet submitted to the Plugin Hub). Multi-row per user,
-- unlike this repo's usual id=1 singleton config tables -- a member can hold
-- several keys (e.g. one per PC) and revoke them independently.
create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  label text,
  token_hash text not null,
  token_prefix text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create unique index if not exists idx_api_keys_token_hash on api_keys(token_hash);
create index if not exists idx_api_keys_user_id on api_keys(user_id);

alter table api_keys enable row level security;

create policy "Users can manage their own api keys"
  on api_keys for all
  using (auth.uid() = user_id);
