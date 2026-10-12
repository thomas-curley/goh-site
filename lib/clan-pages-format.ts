// Shared (client + server) shape of the Rank Structure / Clan Rules pages.

export const CLAN_PAGE_SLUGS = ["rank-structure", "clan-rules"] as const;
export type ClanPageSlug = (typeof CLAN_PAGE_SLUGS)[number];

export const CLAN_PAGE_TITLES: Record<ClanPageSlug, string> = {
  "rank-structure": "Rank Structure",
  "clan-rules": "Clan Rules",
};

export const CLAN_PAGE_MAX_PAGES = 20;

export interface ClanPage {
  slug: ClanPageSlug;
  page_urls: string[];
  pdf_url: string | null;
  updated_by: string | null;
  updated_at: string;
}

export function isClanPageSlug(value: string): value is ClanPageSlug {
  return (CLAN_PAGE_SLUGS as readonly string[]).includes(value);
}
