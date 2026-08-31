-- Admin-settable per-event check-in code. Stored in plain text (not hashed)
-- -- staff need to be able to see and re-announce whatever they set, and
-- it's a low-stakes shared word (announced verbally/in Discord at the
-- event), not a real credential. Null/blank means no code required, so
-- every existing event keeps working exactly as it does today.
alter table events add column if not exists check_in_code text;
