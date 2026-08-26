-- Free-text pronouns field for Gn0meBook profiles, shown next to the
-- member's name. Nullable/optional, same as every other profile field.
alter table member_profiles add column if not exists pronouns text;
