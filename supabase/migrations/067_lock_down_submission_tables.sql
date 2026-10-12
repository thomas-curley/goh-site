-- surveys, survey_responses, feedback_submissions, gnomie_reviews and
-- banned_ips each had a "for all ... using (auth.role() = 'authenticated')"
-- policy, so ANY signed-in user (anyone can sign in with Discord) could read,
-- edit or delete every survey, response, feedback submission and Gn0mie
-- review (IP addresses included) and the ban list straight through the
-- public anon key.
--
-- Every read and write of these tables already goes through server routes
-- using the service-role key, which bypasses RLS and checks permissions
-- itself. Dropping the policies (RLS stays enabled) leaves no direct access.

drop policy if exists "Authenticated users can manage surveys" on surveys;
drop policy if exists "Authenticated users can manage survey responses" on survey_responses;
drop policy if exists "Authenticated users can manage feedback submissions" on feedback_submissions;
drop policy if exists "Authenticated users can manage gnomie reviews" on gnomie_reviews;
drop policy if exists "Authenticated users can manage banned ips" on banned_ips;
