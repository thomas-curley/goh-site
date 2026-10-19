-- Tightens database functions flagged by Supabase's security advisor.
--
-- rate_limit_hit: only the site's server (service role) calls it. 063
-- revoked it from PUBLIC, but Supabase's default privileges grant new
-- functions to anon and authenticated directly, so anyone could still call
-- it through /rest/v1/rpc and run up the counters for another person's
-- account or IP (locking them out of plugin linking).
revoke execute on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;

-- handle_new_user: the auth.users trigger that creates a profile on first
-- sign-in. Triggers don't need the caller to hold EXECUTE, so nobody needs
-- to call it directly. Pin its search_path as it runs as its owner.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
alter function public.handle_new_user() set search_path = public;

-- Shared updated_at trigger (used by the storage-totes tables).
alter function public.update_updated_at() set search_path = public;

-- The storage-totes app shares this database. Its row-level policies call
-- these helpers as the signed-in user, so they keep their EXECUTE grants;
-- they only answer questions about the caller's own facility membership.
-- Pinning search_path closes the search_path-hijack route for SECURITY
-- DEFINER functions without changing what they do.
alter function public.is_facility_member(uuid) set search_path = public;
alter function public.is_facility_owner_or_staff(uuid) set search_path = public;
alter function public.user_facility_role(uuid) set search_path = public;
