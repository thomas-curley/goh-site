-- Configurable default prize structure used to auto-fill the "Add Winners"
-- form's prize amounts when RSNs get pulled in from a picked competition's
-- standings. placements holds explicit per-placement amounts (e.g. 1st/2nd/
-- 3rd); default_amount covers every placement not explicitly listed (e.g.
-- "4th-10th, 500k each"). Single-row config, same id=1 pattern as
-- weekly_competition_config/payout_dm_config.
create table if not exists payout_prize_defaults (
  id integer primary key default 1 check (id = 1),
  placements jsonb not null default '[{"placement":1,"amount":6500000},{"placement":2,"amount":4000000},{"placement":3,"amount":2000000}]',
  default_amount numeric not null default 500000,
  updated_at timestamptz not null default now()
);

insert into payout_prize_defaults (id) values (1) on conflict (id) do nothing;

alter table payout_prize_defaults enable row level security;

create policy "Authenticated users can manage payout prize defaults"
  on payout_prize_defaults for all
  using (auth.role() = 'authenticated');
