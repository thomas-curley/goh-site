import Link from "next/link";
import { getHandbookTree } from "@/lib/handbook";
import { getPublishedEdition, getPublishedEditions, getServiceClient, signEdition } from "@/lib/handbook-editions";
import { checkClanEligibility } from "@/lib/clan-access";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { checkSectionAccess } from "@/lib/section-gate";
import { SectionUnavailable } from "@/components/layout/SectionUnavailable";
import { HandbookReader } from "@/components/handbook/HandbookReader";
import { Card } from "@/components/ui/Card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staff Handbook",
  description: "Everything Gn0me Home staff need to know -- ranks, duties, events, discipline, and the clan rules.",
};

export const dynamic = "force-dynamic";

export default async function StaffHandbookPage({ searchParams }: { searchParams: Promise<{ edition?: string | string[] }> }) {
  if (!(await checkSectionAccess("staff_handbook"))) return <SectionUnavailable />;

  const supabase = getServiceClient();
  const editions = supabase ? await getPublishedEditions(supabase) : [];
  // Until a handbook has been uploaded, keep showing the old text sections.
  if (!supabase || editions.length === 0) return <LegacyHandbookIndex />;

  const { edition: requested } = await searchParams;
  const requestedId = typeof requested === "string" ? requested : null;
  const row = await getPublishedEdition(supabase, requestedId ?? editions[0].id);
  if (!row) {
    return (
      <Gate>
        <p className="text-bark-brown-light mb-4">That edition of the handbook doesn&apos;t exist or was removed.</p>
        <Link href="/staff-handbook" className="text-sm text-gnome-green hover:underline">Read the current handbook &rarr;</Link>
      </Gate>
    );
  }

  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  const eligibility = await checkClanEligibility(supabase, row.visibility, user?.id ?? null, "the staff handbook");
  if (!eligibility.eligible) {
    return (
      <Gate>
        <p className="text-bark-brown-light mb-4">{eligibility.reason}</p>
        {eligibility.reason?.includes("signed in") ? (
          <Link href="/login" className="text-sm text-gnome-green hover:underline">Log in &rarr;</Link>
        ) : eligibility.reason?.includes("Link and verify") ? (
          <Link href="/account" className="text-sm text-gnome-green hover:underline">Go to your Account &rarr;</Link>
        ) : null}
      </Gate>
    );
  }

  return <HandbookReader edition={await signEdition(supabase, row)} editions={editions} isCurrent={row.id === editions[0].id} />;
}

function Gate({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <h1 className="font-display text-4xl text-gnome-green mb-6 text-center">Staff Handbook</h1>
      <Card hover={false} className="text-center py-10">{children}</Card>
    </div>
  );
}

/** The pre-upload handbook: text sections from handbook_sections, each on its own page. */
async function LegacyHandbookIndex() {
  const tree = await getHandbookTree();

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="font-display text-4xl text-gnome-green mb-2">Staff Handbook</h1>
      <p className="text-bark-brown-light mb-10">
        Welcome to the Cadre! Everything you need to know about your new duties, from rank structure to
        running events, lives here. New to Staff? Start with the Preface below.
      </p>

      {tree.length === 0 ? (
        <Card hover={false} className="text-center py-10">
          <p className="text-bark-brown-light">The handbook hasn&apos;t been published yet -- check back soon.</p>
        </Card>
      ) : (
        <ol className="space-y-3">
          {tree.map((section, i) => (
            <li key={section.id}>
              <Link href={`/staff-handbook/${section.slug}`}>
                <Card className="flex items-center gap-4">
                  <span className="font-display text-2xl text-gnome-green/60 w-8 shrink-0 text-center">{i + 1}</span>
                  <div className="min-w-0">
                    <h2 className="font-display text-lg text-bark-brown">{section.title}</h2>
                    {section.children.length > 0 && (
                      <p className="text-xs text-iron-grey mt-0.5">
                        {section.children.map((c) => c.title).join(" · ")}
                      </p>
                    )}
                  </div>
                </Card>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
