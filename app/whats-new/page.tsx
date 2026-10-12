import Link from "next/link";
import type { Metadata } from "next";
import { createClient } from "@supabase/supabase-js";
import { checkClanEligibility } from "@/lib/clan-access";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { Card } from "@/components/ui/Card";
import { WhatsNewList } from "@/components/whats-new/WhatsNewList";
import { WHATS_NEW } from "@/content/whats-new";

export const metadata: Metadata = {
  title: "What's New",
  description: "Recent changes to the clan website, for staff.",
};

export const dynamic = "force-dynamic";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Staff-only log of site changes, with a page-to-page walkthrough. Entries
// live in content/whats-new.ts and ship with each change.
export default async function WhatsNewPage() {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  const supabase = getServiceClient();
  const eligibility = supabase
    ? await checkClanEligibility(supabase, "staff", user?.id ?? null, "What's New")
    : { eligible: true, reason: undefined };

  if (!eligibility.eligible) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="font-display text-4xl text-gnome-green mb-6 text-center">What&apos;s New</h1>
        <Card hover={false} className="text-center py-10">
          <p className="text-bark-brown-light mb-4">{eligibility.reason}</p>
          {eligibility.reason?.includes("signed in") ? (
            <Link href="/login" className="text-sm text-gnome-green hover:underline">Log in &rarr;</Link>
          ) : eligibility.reason?.includes("Link and verify") ? (
            <Link href="/account" className="text-sm text-gnome-green hover:underline">Go to your Account &rarr;</Link>
          ) : null}
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 sm:py-12">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.2em] text-iron-grey">Staff only</p>
        <h1 className="font-display text-4xl text-gnome-green mt-1">What&apos;s New</h1>
        <p className="text-bark-brown-light mt-2">
          Every change to the clan website, newest first, with links to try each one. New changes are added here as they go live.
        </p>
      </header>
      <WhatsNewList entries={WHATS_NEW} />
    </div>
  );
}
