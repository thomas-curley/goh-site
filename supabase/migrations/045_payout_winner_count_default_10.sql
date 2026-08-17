-- Default payout structure is top 10, not top 3.
alter table wom_competitions alter column payout_winner_count set default 10;
