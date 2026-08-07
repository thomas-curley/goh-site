import { requireAuth } from "@/lib/auth";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Welcome",
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect } = await searchParams;
  const { user } = await requireAuth(redirect ? `/onboarding?redirect=${encodeURIComponent(redirect)}` : "/onboarding");

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <h1 className="font-display text-4xl text-gnome-green mb-4">Welcome</h1>
        <p className="text-bark-brown-light">
          Account setup requires Supabase to be configured.
        </p>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh] px-4">
      <OnboardingFlow userId={user.id} redirectTo={redirect || "/"} />
    </div>
  );
}
