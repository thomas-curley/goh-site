import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { checkClanEligibility, isSectionStaffOnly } from "@/lib/clan-access";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { ClaimButton } from "@/components/loans/ClaimButton";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Loan Board",
  description: "Request a short-term GP or item loan against collateral, or volunteer to fund a fellow clan member's request.",
};

export const dynamic = "force-dynamic";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

interface OpenLoan {
  id: string;
  borrower_id: string;
  loan_type: "gp" | "item";
  gp_amount: string | null;
  item_description: string | null;
  timeframe: string;
  purpose: string | null;
  collateral_offered: string;
  collateral_value: string | null;
  repayment_plan: string | null;
  created_at: string;
  borrower: { discord_username: string; rsn: string | null } | null;
}

export default async function LoansBoardPage() {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  const serviceClient = getServiceClient();
  const eligibility = serviceClient
    ? await checkClanEligibility(
        serviceClient,
        (await isSectionStaffOnly(serviceClient, "bank")) ? "staff" : "verified_player",
        user?.id ?? null,
        "the loan board"
      )
    : { eligible: true };

  let loans: OpenLoan[] = [];
  if (eligibility.eligible && serviceClient) {
    const { data } = await serviceClient
      .from("loan_requests")
      .select("*, borrower:user_profiles!loan_requests_borrower_id_fkey(discord_username, rsn)")
      .eq("status", "open")
      .order("created_at", { ascending: false });
    loans = (data as OpenLoan[]) ?? [];
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-12">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <h1 className="font-display text-4xl text-gnome-green">Loan Board</h1>
        <Link href="/loans/apply">
          <Button>Request a Loan</Button>
        </Link>
      </div>
      <p className="text-bark-brown-light mb-10">
        Open loan requests from fellow clan members. Claim one to volunteer as the lender -- coordinate the trade
        over Discord once you do.
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
      ) : loans.length === 0 ? (
        <Card hover={false} className="text-center py-10">
          <p className="text-bark-brown-light">No open loan requests right now.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {loans.map((loan) => {
            const amount = loan.loan_type === "gp" ? loan.gp_amount : loan.item_description;
            const name = loan.borrower?.rsn || loan.borrower?.discord_username || "A clan member";
            const isOwn = loan.borrower_id === user?.id;
            return (
              <Card key={loan.id} hover={false}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs px-2 py-0.5 rounded bg-gnome-green/10 text-gnome-green font-semibold uppercase">
                    {loan.loan_type === "gp" ? "GP Loan" : "Item Loan"}
                  </span>
                  <span className="text-xs text-iron-grey">{loan.timeframe}</span>
                </div>
                <p className="font-display text-lg text-bark-brown mb-1">{amount}</p>
                <p className="text-xs text-iron-grey mb-3">Requested by {name}</p>

                <div className="space-y-2 text-sm text-bark-brown-light mb-4">
                  <p><span className="font-semibold text-bark-brown">Collateral:</span> {loan.collateral_offered}{loan.collateral_value ? ` (~${loan.collateral_value})` : ""}</p>
                  {loan.purpose && <p><span className="font-semibold text-bark-brown">Purpose:</span> {loan.purpose}</p>}
                  {loan.repayment_plan && <p><span className="font-semibold text-bark-brown">Repayment plan:</span> {loan.repayment_plan}</p>}
                </div>

                {isOwn ? (
                  <p className="text-xs text-iron-grey italic">This is your request.</p>
                ) : (
                  <ClaimButton loanId={loan.id} />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
