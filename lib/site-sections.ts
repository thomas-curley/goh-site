// Registry of every public-facing page, gateable per-role from
// /admin/sections. Add a new entry here whenever a new public page ships,
// then wire lib/section-gate.ts's checkSectionAccess() into that page --
// the database (section_visibility table) only stores per-role overrides,
// this list is the source of truth for what's gateable and how it's
// described in the admin UI.
export const SITE_SECTIONS = [
  { key: "home", label: "Home", description: "The homepage (/)." },
  { key: "events", label: "Events", description: "Event calendar (/events)." },
  { key: "gn0mebook", label: "Gn0meBook", description: "Member profile directory." },
  { key: "staff_handbook", label: "Staff Handbook", description: "Internal process docs." },
  { key: "members_list", label: "Member List", description: "Full roster page." },
  { key: "leaderboard", label: "Leaderboard", description: "Attendance/XP leaderboard." },
  { key: "competitions", label: "Competitions", description: "WOM competitions list." },
  { key: "hiscores", label: "Hiscores", description: "Clan hiscores." },
  { key: "guides", label: "Guides", description: "PvM/skilling guides." },
  { key: "tools", label: "Tools", description: "Calculators and utilities." },
  { key: "feedback", label: "Feedback", description: "General feedback form." },
  { key: "surveys", label: "Surveys", description: "Public survey index." },
  { key: "availability", label: "Availability", description: "Availability poll index." },
  { key: "gnomie_reviews", label: "Review a Gn0mie", description: "Public shoutout form." },
  { key: "bank", label: "Bank (Loans)", description: "Loan board, request form, My Loans." },
  { key: "about", label: "About", description: "About page." },
] as const;

export type SiteSectionKey = (typeof SITE_SECTIONS)[number]["key"];
