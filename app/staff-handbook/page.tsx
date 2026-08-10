import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { getHandbookTree } from "@/lib/handbook";
import { checkClanEligibility } from "@/lib/clan-access";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { Card } from "@/components/ui/Card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staff Handbook",
  description: "Everything Gn0me Home staff need to know -- ranks, duties, events, discipline, and the clan rules.",
};

export const dynamic = "force-dynamic";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export default async function StaffHandbookPage() {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  const serviceClient = getServiceClient();
  const eligibility = serviceClient
    ? await checkClanEligibility(serviceClient, "staff", user?.id ?? null, "the Staff Handbook")
    : { eligible: true };

  const tree = eligibility.eligible ? await getHandbookTree() : [];

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="font-display text-4xl text-gnome-green mb-2">Staff Handbook</h1>
      <p className="text-bark-brown-light mb-10">
        Welcome to the Cadre! Everything you need to know about your new duties, from rank structure to
        running events, lives here. New to Staff? Start with the Preface below.
      </p>

      {!eligibility.eligible ? (
        <Card hover={false} className="text-center py-10">
          <p className="text-bark-brown-light mb-4">{eligibility.reason}</p>
          {eligibility.reason?.includes("signed in") ? (
            <Link href="/login" className="text-sm text-gnome-green hover:underline">Log in →</Link>
          ) : eligibility.reason?.includes("Link and verify") ? (
            <Link href="/account" className="text-sm text-gnome-green hover:underline">Go to your Account →</Link>
          ) : null}
        </Card>
      ) : tree.length === 0 ? (
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
