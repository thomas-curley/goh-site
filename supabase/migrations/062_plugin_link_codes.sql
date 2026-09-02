-- One-time pairing codes for linking a RuneLite plugin client to a site
-- account without the member ever handling an API key by hand ("device
-- flow"): the plugin creates a code, opens the site's /plugin/link page, the
-- member approves it while signed in with Discord, and the plugin's next
-- poll receives a freshly minted api_keys token -- exactly once.
--
-- client_secret_hash: the plugin generates a private secret alongside the
-- code and only ever sends its hash here; redeeming the approved code
-- requires presenting the matching secret. Without it, anyone who glimpsed
-- a code (over a shoulder, in a screenshot) could claim the resulting key.
--
-- No plaintext token is ever stored: the key is minted at redeem time, in
-- the same request that hands it to the plugin. api_key_id being set means
-- the code has been consumed and can't be redeemed again.
create table if not exists plugin_link_codes (
  code text primary key,
  client_secret_hash text not null,
  user_id uuid references user_profiles(id) on delete cascade,
  api_key_id uuid references api_keys(id) on delete set null,
  approved_at timestamptz,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_plugin_link_codes_expires_at on plugin_link_codes(expires_at);

-- Touched only by service-role API routes -- no browser-side access at all,
-- so RLS is on with no policies (deny by default).
alter table plugin_link_codes enable row level security;
