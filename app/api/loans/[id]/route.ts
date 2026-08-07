import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { checkClanEligibility } from "@/lib/clan-access";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

type LoanAction = "claim" | "repay" | "cancel";

// PATCH - claim, repay, or cancel a loan request. Every action re-checks
// eligibility and validates the caller against the loan's current state and
// role (borrower vs. lender) server-side -- never trust the client.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  const eligibility = await checkClanEligibility(supabase, "verified_player", user?.id ?? null, "the loan board");
  if (!eligibility.eligible || !user) {
    return NextResponse.json({ error: eligibility.reason ?? "You are not eligible to act on this loan." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const action: LoanAction = body.action;
  if (!["claim", "repay", "cancel"].includes(action)) {
    return NextResponse.json({ error: "Invalid action." }, { status: 400 });
  }

  const { data: loan } = await supabase.from("loan_requests").select("*").eq("id", id).maybeSingle();
  if (!loan) return NextResponse.json({ error: "Loan request not found." }, { status: 404 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (action === "claim") {
    if (loan.status !== "open") {
      return NextResponse.json({ error: "This loan request is no longer open." }, { status: 400 });
    }
    if (loan.borrower_id === user.id) {
      return NextResponse.json({ error: "You can't claim your own loan request." }, { status: 400 });
    }
    update.status = "claimed";
    update.lender_id = user.id;
    update.claimed_at = new Date().toISOString();
  } else if (action === "repay") {
    if (loan.status !== "claimed") {
      return NextResponse.json({ error: "This loan isn't currently claimed." }, { status: 400 });
    }
    if (user.id !== loan.borrower_id && user.id !== loan.lender_id) {
      return NextResponse.json({ error: "Only the borrower or lender can mark this loan repaid." }, { status: 403 });
    }
    update.status = "repaid";
    update.repaid_at = new Date().toISOString();
  } else if (action === "cancel") {
    if (loan.status !== "open") {
      return NextResponse.json({ error: "Only an open loan request can be cancelled." }, { status: 400 });
    }
    if (user.id !== loan.borrower_id) {
      return NextResponse.json({ error: "Only the borrower can cancel this request." }, { status: 403 });
    }
    update.status = "cancelled";
  }

  const { error } = await supabase.from("loan_requests").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to update loan request." }, { status: 500 });

  return NextResponse.json({ updated: true });
}
