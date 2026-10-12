import type { Metadata } from "next";
import type { Newsletter } from "@/lib/newsletter-format";

/** Title, description and page-1 preview image, so a shared link unfurls nicely in Discord. */
export function newsletterMetadata(issue: Newsletter | null): Metadata {
  if (!issue) return { title: "The Weekly Glider", description: "Gn0me Home's weekly newsletter." };
  const title = `${issue.title} — Issue No. ${issue.issue_number}`;
  const description = issue.headline ?? `Issue No. ${issue.issue_number} of Gn0me Home's weekly newsletter.`;
  const images = issue.page_urls[0] ? [{ url: issue.page_urls[0] }] : undefined;
  return {
    title,
    description,
    openGraph: { title, description, images, type: "article" },
    twitter: { card: images ? "summary_large_image" : "summary", title, description, images: images?.map((i) => i.url) },
  };
}
