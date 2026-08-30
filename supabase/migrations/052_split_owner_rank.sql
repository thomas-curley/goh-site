-- "owner" is now its own rank, separate from council_member (see
-- lib/constants.ts's RANKS/COUNCIL_ALIASES), so it can be permissioned
-- independently. Bootstrap it with whatever council_member currently has
-- granted, so the site owner doesn't lose admin access the moment this
-- ships -- from here on the two are managed separately at /admin/permissions.
insert into role_permissions (role, permission, granted)
select 'owner', permission, granted
from role_permissions
where role = 'council_member'
on conflict (role, permission) do nothing;
