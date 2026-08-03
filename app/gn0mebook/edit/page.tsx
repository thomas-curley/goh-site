import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "@/lib/auth";
import { checkClanEligibility } from "@/lib/clan-access";
import { getProfileByUserId } from "@/lib/gn0mebook";
import { ProfileEditForm } from "@/components/gn0mebook/ProfileEditForm";
import { Card } from "@/components/ui/Card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit My Gn0meBook Profile",
  robots: { index: false, follow: false },
};

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export default async function EditGn0meBookPage() {
  const { user } = await requireAuth("/gn0mebook/edit");

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <h1 className="font-display text-3xl text-gnome-green mb-4">My Gn0meBook Profile</h1>
        <p className="text-bark-brown-light">
          This requires Supabase to be configured. Add your Supabase credentials to <code className="font-mono text-gnome-green">.env.local</code>.
        </p>
      </div>
    );
  }

  const supabase = getServiceClient();
  const eligibility = supabase
    ? await checkClanEligibility(supabase, "verified_player", user.id, "a Gn0meBook profile")
    : { eligible: false, reason: "Supabase not configured." };

  if (!eligibility.eligible) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <h1 className="font-display text-3xl text-gnome-green mb-4">My Gn0meBook Profile</h1>
        <Card hover={false} className="text-center py-10">
          <p className="text-bark-brown-light mb-4">{eligibility.reason}</p>
          <Link href="/account" className="text-sm text-gnome-green hover:underline">Go to your Account →</Link>
        </Card>
      </div>
    );
  }

  const existing = await getProfileByUserId(user.id);

  return (
    <div className="max-w-2xl mx-auto px-4 py-16">
      <h1 className="font-display text-3xl text-gnome-green mb-1">My Gn0meBook Profile</h1>
      <p className="text-bark-brown-light mb-8">
        Let the clan (or the world, if you want) know who you are. Anything you leave blank just won&apos;t show up on your page.
      </p>
      <ProfileEditForm initialProfile={existing} profileId={existing?.id ?? null} />
    </div>
  );
}
