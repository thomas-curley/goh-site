-- New rank structure: Gold Key > Silver Key > Yew > Pine > Oak > Council >
-- Gnome Child. Gold Key is the in-game/WOM Owner rank, Silver Key is Deputy
-- Owner, and Council is Summoner (now below Oak). Previously owner and
-- council_member (owner's deputies + summoners) were the top two.
--
-- Step 1 of 2: add the new ranks' rows next to the old ones, so access
-- carries on whether the old or new code is running. 080 removes the old
-- 'owner' and 'council_member' rows once the new code is live.
--   gold_key   <- owner's permissions
--   silver_key <- council_member's permissions
--   council    <- oak's permissions (Council now sits just below Oak)

insert into role_permissions (role, permission, granted)
select 'gold_key', permission, granted from role_permissions where role = 'owner'
on conflict (role, permission) do update set granted = excluded.granted;

insert into role_permissions (role, permission, granted)
select 'silver_key', permission, granted from role_permissions where role = 'council_member'
on conflict (role, permission) do update set granted = excluded.granted;

insert into role_permissions (role, permission, granted)
select 'council', permission, granted from role_permissions where role = 'oak'
on conflict (role, permission) do update set granted = excluded.granted;

insert into section_visibility (role, section_key, visible)
select 'gold_key', section_key, visible from section_visibility where role = 'owner'
on conflict (role, section_key) do update set visible = excluded.visible;

insert into section_visibility (role, section_key, visible)
select 'silver_key', section_key, visible from section_visibility where role = 'council_member'
on conflict (role, section_key) do update set visible = excluded.visible;

insert into section_visibility (role, section_key, visible)
select 'council', section_key, visible from section_visibility where role = 'oak'
on conflict (role, section_key) do update set visible = excluded.visible;
