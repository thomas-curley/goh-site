-- Weekly SOTW/BotW turnover is now a manual, previewed flow (enter raffle
-- winners -> preview -> post) instead of a blind Sunday cron. It needs to
-- remember a few things between weeks:
--   current_forum_thread_id   -- this week's forum thread, where next week's
--                                results get posted as a reply
--   current_competition_emoji -- this week's header emoji, reused in its
--                                results post
--   ping_role_ids             -- who the results post pings (role ids, or
--                                "@everyone"/"@here")
--   raffle_prize_amount       -- GP each raffle winner takes home
alter table weekly_competition_config
  add column if not exists current_forum_thread_id text,
  add column if not exists current_competition_emoji text,
  add column if not exists ping_role_ids text[] not null default '{}',
  add column if not exists raffle_prize_amount numeric not null default 1000000;
