-- member_profiles.user_id originally referenced auth.users(id) directly.
-- PostgREST's embed syntax (used throughout lib/gn0mebook.ts and the admin
-- route as `user_profiles!inner(...)`) needs an actual foreign key between
-- the two specific tables to auto-join them -- referencing auth.users
-- instead of user_profiles meant that join would have silently failed.
-- user_profiles.id already references auth.users(id) itself, so this is
-- just as correct and gives PostgREST the direct relationship it needs.
alter table member_profiles drop constraint member_profiles_user_id_fkey;
alter table member_profiles add constraint member_profiles_user_id_fkey
  foreign key (user_id) references user_profiles(id) on delete cascade;
