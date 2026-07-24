-- Admin-configurable Discord alert-channel destinations, so redirecting
-- where a feature posts doesn't require a Vercel env var change + redeploy.
-- One row per feature; a null/missing row means "use the env var default"
-- (see lib/alert-channels.ts for the registry + resolution logic).
create table if not exists alert_channels (
  id uuid primary key default gen_random_uuid(),
  feature_key text not null unique,
  channel_id text,
  updated_by text,
  updated_at timestamptz not null default now()
);

alter table alert_channels enable row level security;

create policy "Authenticated users can manage alert channels"
  on alert_channels for all
  using (auth.role() = 'authenticated');
