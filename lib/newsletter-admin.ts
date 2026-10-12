import { createClient } from "@supabase/supabase-js";

export function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const MAX_PAGES = 12;
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").host;
  } catch {
    return "";
  }
})();

/** Only files from this project's own storage -- the pages render as <img> on a public page. */
function isOwnStorageUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (!supabaseHost || url.host === supabaseHost);
  } catch {
    return false;
  }
}

/**
 * Validates the editable fields of an issue from a request body. With
 * `partial`, absent fields are left out (for PATCH); otherwise required
 * fields must be present. Returns an error message instead on bad input.
 */
export function parseNewsletterBody(body: Record<string, unknown>, partial: boolean): { update: Record<string, unknown> } | { error: string } {
  const update: Record<string, unknown> = {};

  if (body.issueNumber !== undefined || !partial) {
    const n = Number(body.issueNumber);
    if (!Number.isInteger(n) || n < 1) return { error: "Issue number must be a whole number above 0." };
    update.issue_number = n;
  }
  if (body.title !== undefined) {
    const title = typeof body.title === "string" ? body.title.trim().slice(0, 100) : "";
    update.title = title || "The Weekly Glider";
  }
  if (body.headline !== undefined) {
    update.headline = typeof body.headline === "string" ? body.headline.trim().slice(0, 200) || null : null;
  }
  if (body.publishedOn !== undefined || !partial) {
    const d = typeof body.publishedOn === "string" ? body.publishedOn : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return { error: "Pick the issue's date." };
    update.published_on = d;
  }
  if (body.pageUrls !== undefined || !partial) {
    const pages = Array.isArray(body.pageUrls) ? body.pageUrls : [];
    if (!pages.every(isOwnStorageUrl)) return { error: "Pages must be uploaded through this page." };
    if (pages.length > MAX_PAGES) return { error: `An issue can have at most ${MAX_PAGES} pages.` };
    update.page_urls = pages;
  }
  if (body.pdfUrl !== undefined) {
    if (body.pdfUrl !== null && body.pdfUrl !== "" && !isOwnStorageUrl(body.pdfUrl)) return { error: "The PDF must be uploaded through this page." };
    update.pdf_url = body.pdfUrl || null;
  }
  if (body.isPublished !== undefined) update.is_published = body.isPublished === true;

  if (update.is_published === true && Array.isArray(update.page_urls) && update.page_urls.length === 0) {
    return { error: "Add at least one page before publishing." };
  }
  return { update };
}
