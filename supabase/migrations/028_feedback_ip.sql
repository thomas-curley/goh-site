-- Lets feedback submissions be checked against the same banned_ips list
-- already enforced on survey responses (see 027_banned_ips.sql).
alter table feedback_submissions add column if not exists ip_address inet;
