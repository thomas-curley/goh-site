-- The Discord thread the weekly turnover posts next-next week's SOTW/BotW
-- voting poll into ("SOTW / BOTW VOTING POLL"), remembered between turnovers
-- like current_forum_thread_id.
alter table weekly_competition_config
  add column if not exists voting_thread_id text;
