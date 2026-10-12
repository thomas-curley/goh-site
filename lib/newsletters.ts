import "server-only";
import { createClient } from "@supabase/supabase-js";

import type { Newsletter, NewsletterSummary } from "@/lib/newsletter-format";

export type { Newsletter, NewsletterSummary };

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** Every published issue, newest first. */
export async function getPublishedNewsletters(): Promise<NewsletterSummary[]> {
  const supabase = getServiceClient();
  if (!supabase) return [];
  const { data } = await supabase
    .from("newsletters")
    .select("id, issue_number, title, headline, published_on, page_urls")
    .eq("is_published", true)
    .order("issue_number", { ascending: false });
  return (data ?? []).map(({ page_urls, ...rest }) => ({ ...rest, cover_url: (page_urls as string[])[0] ?? null }));
}

/** One published issue by number, or null. */
export async function getPublishedNewsletter(issueNumber: number): Promise<Newsletter | null> {
  const supabase = getServiceClient();
  if (!supabase || !Number.isInteger(issueNumber)) return null;
  const { data } = await supabase.from("newsletters").select("*").eq("issue_number", issueNumber).eq("is_published", true).maybeSingle();
  return (data as Newsletter | null) ?? null;
}
