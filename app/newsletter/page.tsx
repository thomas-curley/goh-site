import type { Metadata } from "next";
import { checkSectionAccess } from "@/lib/section-gate";
import { SectionUnavailable } from "@/components/layout/SectionUnavailable";
import { NewsletterReader } from "@/components/newsletter/NewsletterReader";
import { getPublishedNewsletter, getPublishedNewsletters } from "@/lib/newsletters";
import { newsletterMetadata } from "@/lib/newsletter-metadata";

export const dynamic = "force-dynamic"; // gated per-viewer, and always shows the newest issue

export async function generateMetadata(): Promise<Metadata> {
  const [latest] = await getPublishedNewsletters();
  return newsletterMetadata(latest ? await getPublishedNewsletter(latest.issue_number) : null);
}

// /newsletter -- always the latest issue (the link to share each week).
export default async function NewsletterPage() {
  if (!(await checkSectionAccess("newsletter"))) return <SectionUnavailable />;

  const archive = await getPublishedNewsletters();
  const latest = archive[0] ? await getPublishedNewsletter(archive[0].issue_number) : null;

  if (!latest) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-display text-4xl text-gnome-green mb-2">The Weekly Glider</h1>
        <p className="text-bark-brown-light">The first issue is on its way -- check back soon! 🌳</p>
      </div>
    );
  }
  return <NewsletterReader issue={latest} archive={archive} />;
}
