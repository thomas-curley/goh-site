// Shared by the public newsletter pages and the admin page -- no server-only
// imports, so it's safe in client components.

export interface Newsletter {
  id: string;
  issue_number: number;
  title: string;
  headline: string | null;
  /** "YYYY-MM-DD" */
  published_on: string;
  page_urls: string[];
  pdf_url: string | null;
  is_published: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** What the archive needs per issue -- page 1 doubles as its thumbnail. */
export type NewsletterSummary = Pick<Newsletter, "id" | "issue_number" | "title" | "headline" | "published_on"> & { cover_url: string | null };

/** "Monday, 12 October 2026" -- the date is a calendar day, so format it as UTC to avoid shifting it. */
export function formatIssueDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
