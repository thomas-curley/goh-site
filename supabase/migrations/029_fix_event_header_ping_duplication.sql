-- The seeded event header sections hardcoded the literal text "@Event Pings"
-- into the title line, duplicating whatever role(s) are actually selected as
-- ping roles -- those are already rendered correctly as real mentions by the
-- separate role_ping_prefix block. Strip the dead literal text; the emoji +
-- title formatting is untouched.
update post_sections
set config = jsonb_set(config, '{template}', to_jsonb(replace(config->>'template', '@Event Pings ', '')))
where config::text ilike '%Event Pings%';
