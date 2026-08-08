-- The whole Staff Handbook is now staff-only, including Appendix A: Clan
-- Rules, which had deliberately been left public -- reversed per an
-- explicit request to hide the entire handbook from non-staff.
update handbook_sections
set visibility = 'staff'
where slug = 'appendix-clan-rules' or parent_slug = 'appendix-clan-rules';
