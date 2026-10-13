-- Gn0meBook profiles can show the member's 3D OSRS character (beta), if
-- they opt in. The character itself lives in profile_outfits (070).
alter table member_profiles add column if not exists show_character boolean not null default false;
