-- Step 2 of 2 (after the Gold Key / Silver Key / Council code is live):
-- remove the old rank rows that 079 copied from.
delete from role_permissions where role in ('owner', 'council_member');
delete from section_visibility where role in ('owner', 'council_member');
