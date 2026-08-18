import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { checkClanEligibility } from "@/lib/clan-access";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { checkSectionAccess } from "@/lib/section-gate";
import { SectionUnavailable } from "@/components/layout/SectionUnavailable";
import { LoanApplicationForm } from "@/components/loans/LoanApplicationForm";
import { Card } from "@/components/ui/Card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Request a Loan",
  description: "Request a short-term GP or item loan from a fellow clan member, against collateral.",
};

export const dynamic = "force-dynamic";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export default async function LoanApplyPage() {
  if (!(await checkSectionAccess("bank"))) return <SectionUnavailable />;

  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  const serviceClient = getServiceClient();
  const eligibility = serviceClient
    ? await checkClanEligibility(serviceClient, "verified_player", user?.id ?? null, "the loan board")
    : { eligible: true };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="font-display text-4xl text-gnome-green mb-2">Request a Loan</h1>
      <p className="text-bark-brown-light mb-10">
        Fill out the details below. Your request will be posted to the{" "}
        <Link href="/loans" className="text-gnome-green hover:underline">Loan Board</Link>{" "}
        for other members to volunteer to fund.
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
      ) : (
        <LoanApplicationForm verifiedName={eligibility.verifiedName ?? ""} />
      )}
    </div>
  );
}
