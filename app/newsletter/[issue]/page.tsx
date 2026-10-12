import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { checkSectionAccess } from "@/lib/section-gate";
import { SectionUnavailable } from "@/components/layout/SectionUnavailable";
import { NewsletterReader } from "@/components/newsletter/NewsletterReader";
import { getPublishedNewsletter, getPublishedNewsletters } from "@/lib/newsletters";
import { newsletterMetadata } from "@/lib/newsletter-metadata";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ issue: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { issue } = await params;
  return newsletterMetadata(await getPublishedNewsletter(Number(issue)));
}

// /newsletter/9 -- a specific issue, for the archive and for sharing.
export default async function NewsletterIssuePage({ params }: Params) {
  if (!(await checkSectionAccess("newsletter"))) return <SectionUnavailable />;

  const { issue: raw } = await params;
  const issueNumber = Number(raw);
  if (!/^\d+$/.test(raw)) notFound();

  const [issue, archive] = await Promise.all([getPublishedNewsletter(issueNumber), getPublishedNewsletters()]);
  if (!issue) notFound();
  return <NewsletterReader issue={issue} archive={archive} />;
}
