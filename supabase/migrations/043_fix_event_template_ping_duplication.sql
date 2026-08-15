-- Migration 029 stripped the dead literal "@Event Pings" text from the
-- reusable post_sections library, but post_templates.sections stores its own
-- embedded snapshot of each section's config at the time it was added to a
-- template -- that fix never propagated to templates that already had the
-- section saved. The seeded "Default Event Post" template still had it,
-- duplicating whatever role(s) are actually selected as ping roles (already
-- rendered correctly by the separate role_ping_prefix block).
update post_templates
set sections = replace(sections::text, '@Event Pings ', '')::jsonb
where sections::text ilike '%Event Pings%';
