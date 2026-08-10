-- Standalone ledger for tracking whether a competition/raffle/giveaway
-- winner has actually been paid out -- deliberately not tied to any
-- specific source table (wom_competitions has no winner/prize concept at
-- all, event_recap_posts.winners has no "paid" field), since winners come
-- from several different places (SOTW/BOTW, event recaps, raffles, ad-hoc
-- giveaways) that don't share a common schema.
create table if not exists prize_payouts (
  id uuid primary key default gen_random_uuid(),
  recipient_rsn text not null,
  prize text not null,
  category text not null default 'other' check (category in ('sotw', 'botw', 'event', 'raffle', 'giveaway', 'other')),
  source_detail text,
  is_paid boolean not null default false,
  paid_at timestamptz,
  paid_by text,
  notes text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_prize_payouts_is_paid on prize_payouts(is_paid);

alter table prize_payouts enable row level security;
create policy "Authenticated users can manage prize payouts" on prize_payouts for all using (auth.role() = 'authenticated');
