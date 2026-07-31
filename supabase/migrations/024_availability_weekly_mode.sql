-- Lets an availability poll be either the original "specific calendar
-- days" kind (mode = 'dates', unchanged) or a recurring "generic days of
-- the week" kind (mode = 'weekly') meant to stay open indefinitely and
-- gauge a standing weekly pattern (e.g. "which weeknight works best for
-- our regular raid") rather than schedule one specific occurrence.
alter table availability_polls add column if not exists mode text not null default 'dates' check (mode in ('dates', 'weekly'));
alter table availability_polls add column if not exists weekdays text[];
alter table availability_polls alter column days drop not null;

alter table availability_polls add constraint availability_polls_mode_fields_check check (
  (mode = 'dates' and days is not null and weekdays is null) or
  (mode = 'weekly' and weekdays is not null and days is null)
);
