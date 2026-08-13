-- Standing per-account weekly availability (generic days-of-week, not tied
-- to any specific poll/event/date) -- lets staff see clan-wide patterns of
-- who's generally around on which days without spinning up a poll first.
alter table user_profiles add column if not exists available_weekdays text[] not null default '{}';
