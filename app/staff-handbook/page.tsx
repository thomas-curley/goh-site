import Link from "next/link";
import { getHandbookTree } from "@/lib/handbook";
import { Card } from "@/components/ui/Card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staff Handbook",
  description: "Everything Gn0me Home staff need to know -- ranks, duties, events, discipline, and the clan rules.",
};

export const revalidate = 300;

export default async function StaffHandbookPage() {
  const tree = await getHandbookTree();

  // Roughly midway through the list, so the divider graphic breaks up a
  // long table of contents instead of just bookending it top and bottom.
  const midpoint = Math.ceil(tree.length / 2);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/handbook/cover.png"
        alt="Gn0me Home Staff Handbook -- A Guide through the Forest for New Trees"
        className="w-40 sm:w-48 mx-auto mb-8 rounded-lg shadow-lg"
      />

      <h1 className="font-display text-4xl text-gnome-green mb-2 text-center">Staff Handbook</h1>
      <p className="text-bark-brown-light mb-10 text-center max-w-xl mx-auto">
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
              {i === midpoint && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/images/handbook/toc-divider.png"
                  alt=""
                  className="w-full h-24 object-cover rounded-lg mb-3 opacity-90"
                />
              )}
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

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/handbook/back-cover.png"
        alt="Thank you for being a Gnome!"
        className="w-40 sm:w-48 mx-auto mt-10 rounded-lg shadow-lg"
      />
    </div>
  );
}
