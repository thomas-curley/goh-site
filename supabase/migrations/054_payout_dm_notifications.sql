-- Optional Discord DM notification when a prize payout winner is added.
-- recipient_user_id is resolved best-effort at insert time (RSN matched
-- against a linked+verified account); dm_status is only ever set once an
-- actual send has been attempted -- null means notification was never
-- requested/attempted for this row.
alter table prize_payouts add column if not exists recipient_user_id uuid references user_profiles(id) on delete set null;
alter table prize_payouts add column if not exists placement integer;
alter table prize_payouts add column if not exists dm_requested boolean not null default false;
alter table prize_payouts add column if not exists dm_status text check (dm_status in ('sent', 'failed', 'skipped'));
alter table prize_payouts add column if not exists dm_sent_at timestamptz;
alter table prize_payouts add column if not exists dm_error text;

-- Single-row admin-configurable message template (see weekly_competition_config
-- for the same id=1 singleton pattern).
create table if not exists payout_dm_config (
  id integer primary key default 1 check (id = 1),
  template text not null default '🎉 Congratulations {user}! You have a prize pending from **{competition}**: **{payout}**. Reach out to Vlad or Ches on Discord to collect it! 🌿',
  updated_at timestamptz not null default now()
);

insert into payout_dm_config (id) values (1) on conflict (id) do nothing;

alter table payout_dm_config enable row level security;

create policy "Authenticated users can manage payout dm config"
  on payout_dm_config for all
  using (auth.role() = 'authenticated');
