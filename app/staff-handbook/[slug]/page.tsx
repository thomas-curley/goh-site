import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { getHandbookTree, flattenHandbookTree, type HandbookNode } from "@/lib/handbook";
import { checkClanEligibility } from "@/lib/clan-access";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { checkSectionAccess } from "@/lib/section-gate";
import { SectionUnavailable } from "@/components/layout/SectionUnavailable";
import { RichText } from "@/lib/render-lite-markdown";
import { Card } from "@/components/ui/Card";
import type { Metadata } from "next";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export const revalidate = 300;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tree = await getHandbookTree();
  const section = flattenHandbookTree(tree).find((s) => s.slug === slug);
  return { title: section ? `${section.title} - Staff Handbook` : "Staff Handbook" };
}

function SidebarNav({ tree, activeSlug }: { tree: HandbookNode[]; activeSlug: string }) {
  return (
    <nav className="space-y-1">
      {tree.map((node) => (
        <div key={node.id}>
          <Link
            href={`/staff-handbook/${node.slug}`}
            className={`block px-3 py-1.5 rounded-md text-sm transition-colors ${
              node.slug === activeSlug ? "bg-gnome-green text-text-light font-semibold" : "text-bark-brown hover:bg-parchment-dark"
            }`}
          >
            {node.title}
          </Link>
          {node.children.length > 0 && (
            <div className="ml-3 border-l border-parchment-dark pl-2 space-y-0.5 mt-0.5">
              {node.children.map((child) => (
                <Link
                  key={child.id}
                  href={`/staff-handbook/${child.slug}`}
                  className={`block px-3 py-1 rounded-md text-xs transition-colors ${
                    child.slug === activeSlug ? "bg-gnome-green text-text-light font-semibold" : "text-bark-brown-light hover:bg-parchment-dark"
                  }`}
                >
                  {child.title}
                </Link>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}

export default async function HandbookSectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tree = await getHandbookTree();
  const flat = flattenHandbookTree(tree);
  const section = flat.find((s) => s.slug === slug);

  if (!section) notFound();
  if (!(await checkSectionAccess("staff_handbook"))) return <SectionUnavailable />;

  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  const serviceClient = getServiceClient();
  const eligibility = serviceClient
    ? await checkClanEligibility(serviceClient, section.visibility, user?.id ?? null, "the staff handbook")
    : { eligible: true };

  const index = flat.findIndex((s) => s.slug === slug);
  const prev = index > 0 ? flat[index - 1] : null;
  const next = index < flat.length - 1 ? flat[index + 1] : null;

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-8">
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <Link href="/staff-handbook" className="text-xs text-gnome-green hover:underline mb-3 inline-block">
            &larr; All Sections
          </Link>
          <SidebarNav tree={tree} activeSlug={slug} />
        </aside>

        <div className="min-w-0">
          <h1 className="font-display text-3xl text-gnome-green mb-6">{section.title}</h1>

          {!eligibility.eligible ? (
            <Card hover={false} className="text-center py-10">
              <p className="text-bark-brown-light mb-4">{eligibility.reason}</p>
              {eligibility.reason?.includes("signed in") ? (
                <Link href="/login" className="text-sm text-gnome-green hover:underline">Log in &rarr;</Link>
              ) : eligibility.reason?.includes("Link and verify") ? (
                <Link href="/account" className="text-sm text-gnome-green hover:underline">Go to your Account &rarr;</Link>
              ) : null}
            </Card>
          ) : (
            <>
              {section.banner_image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={section.banner_image_url}
                  alt=""
                  className="w-full h-40 sm:h-52 object-cover object-bottom rounded-lg mb-6 shadow-md"
                />
              )}

              <Card hover={false}>
                <RichText content={section.content} />
              </Card>

              {section.pull_quote && (
                <blockquote className="border-l-4 border-gnome-green pl-4 py-1 my-8 text-lg italic text-bark-brown-light">
                  &ldquo;{section.pull_quote}&rdquo;
                </blockquote>
              )}

              <div className="flex items-center justify-between mt-8 pt-6 border-t border-parchment-dark text-sm">
                {prev ? (
                  <Link href={`/staff-handbook/${prev.slug}`} className="text-gnome-green hover:underline">
                    &larr; {prev.title}
                  </Link>
                ) : <span />}
                {next ? (
                  <Link href={`/staff-handbook/${next.slug}`} className="text-gnome-green hover:underline">
                    {next.title} &rarr;
                  </Link>
                ) : <span />}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
