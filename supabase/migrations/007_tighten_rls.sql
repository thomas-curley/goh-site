-- Enable RLS on tables that were fully exposed to the anon/authenticated
-- roles (no policies at all previously). All actual reads/writes to these
-- tables go through Next.js API routes using the service role key, which
-- bypasses RLS entirely, so locking these down has no effect on the app.

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Event details are already shown publicly on the events calendar and
-- per-event check-in pages, so allow anyone to read them directly too.
CREATE POLICY "Anyone can view events"
  ON public.events FOR SELECT
  USING (true);

-- No insert/update/delete policy is added: all event creation/editing goes
-- through /api/events routes (service role), so anon/authenticated writes
-- are denied by default now instead of being wide open.

ALTER TABLE public.wom_cache ENABLE ROW LEVEL SECURITY;
-- wom_cache is an internal server-side cache with no client reads/writes
-- anywhere in the app; leave it with no policies (service role only).

-- event_attendance previously had a single "ALL for any authenticated user"
-- policy, letting any logged-in member insert/update/delete ANY row for ANY
-- event via a direct browser Supabase call (devtools), not just their own.
-- Nothing in the app actually relies on this — the admin attendance UI and
-- the new self check-in endpoint both write via the service role key with
-- server-verified identity. Dropping it removes the blanket access; service
-- role access is unaffected.
DROP POLICY IF EXISTS "Authenticated users can manage attendance" ON public.event_attendance;
