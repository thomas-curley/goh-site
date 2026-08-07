-- Clan loan board ("Gnome Bank"): members request short-term GP/item loans
-- against collateral, other members volunteer to fund ("claim") one.
-- borrower_id/lender_id reference user_profiles (not auth.users) even though
-- user_profiles.id IS auth.users.id 1:1 -- PostgREST can only embed-join
-- through a FK that points at the table you want to select, so this lets
-- API routes pull rsn/discord_username via `user_profiles!...(...)`.
create table loan_requests (
  id uuid primary key default gen_random_uuid(),
  borrower_id uuid not null references user_profiles(id) on delete cascade,
  loan_type text not null check (loan_type in ('gp', 'item')),
  gp_amount text,
  item_description text,
  timeframe text not null,
  purpose text,
  collateral_offered text not null,
  collateral_value text,
  previous_loans text,
  repayment_plan text,
  additional_notes text,
  agreed_terms boolean not null default false,
  status text not null default 'open' check (status in ('open', 'claimed', 'repaid', 'cancelled')),
  lender_id uuid references user_profiles(id),
  claimed_at timestamptz,
  repaid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_loan_requests_status on loan_requests(status);
create index if not exists idx_loan_requests_borrower_id on loan_requests(borrower_id);
create index if not exists idx_loan_requests_lender_id on loan_requests(lender_id);

alter table loan_requests enable row level security;

create policy "Authenticated users can manage loan requests" on loan_requests
  for all using (auth.role() = 'authenticated');
