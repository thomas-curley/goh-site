// Registry of site "sections" that can be toggled staff-only from
// /admin/sections. Add a new entry here whenever a future feature needs the
// same "hide this from non-staff until it's released" treatment -- the
// database (site_sections table) only stores overrides, this list is the
// source of truth for what's togglable and how it's described in the UI.
export const SITE_SECTIONS = [
  {
    key: "bank",
    label: "Bank (Loans)",
    description: "Loan board, request form, and My Loans -- not released yet.",
  },
] as const;

export type SiteSectionKey = (typeof SITE_SECTIONS)[number]["key"];
