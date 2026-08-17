-- Lets a competition's payout auto-capture (see the daily snapshot cron)
-- know how many top finishers to pay out, and whether it's already run
-- once for a given competition so it never double-inserts.
alter table wom_competitions add column if not exists payout_winner_count integer not null default 3;
alter table wom_competitions add column if not exists winners_captured boolean not null default false;

-- First-class weekly raffle tracking. Winners are prize_payouts rows with
-- raffle_id set, not a separate winners table -- keeps "a person is owed a
-- prize" in one place regardless of source (competition, event, or raffle).
create table if not exists raffles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  occurred_on date not null default current_date,
  notes text,
  created_by text,
  created_at timestamptz not null default now()
);

alter table raffles enable row level security;
create policy "Authenticated users can manage raffles" on raffles for all using (auth.role() = 'authenticated');

-- Optional links from a payout entry back to the site record it came from.
-- "on delete set null" so deleting a raffle/event/competition later just
-- unlinks its payouts rather than deleting payment history.
alter table prize_payouts add column if not exists wom_competition_id uuid references wom_competitions(id) on delete set null;
alter table prize_payouts add column if not exists event_id uuid references events(id) on delete set null;
alter table prize_payouts add column if not exists raffle_id uuid references raffles(id) on delete set null;

create index if not exists idx_prize_payouts_wom_competition on prize_payouts(wom_competition_id);
create index if not exists idx_prize_payouts_raffle on prize_payouts(raffle_id);

-- Proof-of-payment screenshots (e.g. the trade window), uploaded per entry.
alter table prize_payouts add column if not exists screenshot_urls text[] not null default '{}';
