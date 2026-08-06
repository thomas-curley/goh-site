-- Restrict the internal staff-process handbook pages to Staff rank
-- (Oak and above) rather than any Clan Member -- Appendix A: Clan Rules
-- and its subsections stay public/anonymous.
update handbook_sections
set visibility = 'staff'
where parent_slug is distinct from 'appendix-clan-rules'
  and slug <> 'appendix-clan-rules';
