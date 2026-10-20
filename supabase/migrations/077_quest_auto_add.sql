-- Quest events can include the whole clan: everyone on the Wise Old Man
-- group is added, and anyone who joins the clan during the event is added
-- when they're first seen (their starting point is taken then, so only
-- quests after they join count).
alter table quest_events add column auto_add_members boolean not null default false;
