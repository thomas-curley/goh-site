-- Adds a 4th access tier ("staff") to the shared AccessLevel system
-- (lib/clan-access.ts), on top of anonymous/verified_player/clan_member.
-- Needed so the Staff Handbook can restrict its internal process pages to
-- actual Staff rank (Oak and above) rather than any clan member.
alter table handbook_sections drop constraint handbook_sections_visibility_check;
alter table handbook_sections
  add constraint handbook_sections_visibility_check
  check (visibility in ('anonymous', 'verified_player', 'clan_member', 'staff'));
alter table handbook_sections alter column visibility set default 'staff';
