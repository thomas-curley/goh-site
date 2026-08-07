-- Lets staff attach a note (e.g. why a loan was force-cancelled) when they
-- override a loan's status from the admin oversight page.
alter table loan_requests add column if not exists admin_note text;
