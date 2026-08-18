import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { checkClanEligibility, isSectionVisible } from "@/lib/clan-access";
import { getAlertChannel } from "@/lib/alert-channels";
import { postToDestination } from "@/lib/discord";
import { LOAN_TIMEFRAMES, LOAN_PURPOSES, PREVIOUS_LOAN_OPTIONS, type LoanType, type LoanStatus } from "@/lib/loans";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const VALID_STATUSES: LoanStatus[] = ["open", "claimed", "repaid", "cancelled"];
const MAX_TEXT_LENGTH = 1000;

// GET - list loans (default: open ones, for the board). Every loans page
// requires a verified, linked RSN -- returns eligibility so the page can
// show the gate screen before revealing any loan details.
export async function GET(request: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();

  if (!(await isSectionVisible(supabase, "bank", user?.id ?? null))) {
    return NextResponse.json({ loans: [], eligibility: { eligible: false, reason: "This section isn't available to you right now." } });
  }

  const eligibility = await checkClanEligibility(supabase, "verified_player", user?.id ?? null, "the loan board");

  if (!eligibility.eligible) {
    return NextResponse.json({ loans: [], eligibility });
  }

  const requestedStatus = request.nextUrl.searchParams.get("status");
  const status = VALID_STATUSES.includes(requestedStatus as LoanStatus) ? requestedStatus : "open";
  const { data, error } = await supabase
    .from("loan_requests")
    .select("*, borrower:user_profiles!loan_requests_borrower_id_fkey(discord_username, rsn)")
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Failed to load loans." }, { status: 500 });

  return NextResponse.json({ loans: data ?? [], eligibility });
}

// POST - submit a new loan request. Identity (borrower) comes from the
// caller's own verified session, never the request body.
export async function POST(request: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();

  if (!(await isSectionVisible(supabase, "bank", user?.id ?? null))) {
    return NextResponse.json({ error: "This section isn't available to you right now." }, { status: 403 });
  }

  const eligibility = await checkClanEligibility(supabase, "verified_player", user?.id ?? null, "the loan board");
  if (!eligibility.eligible || !user) {
    return NextResponse.json({ error: eligibility.reason ?? "You are not eligible to request a loan." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));

  const loanType: LoanType = body.loanType === "item" ? "item" : "gp";
  const timeframe = typeof body.timeframe === "string" ? body.timeframe : "";
  const purpose = typeof body.purpose === "string" && LOAN_PURPOSES.includes(body.purpose) ? body.purpose : null;
  const collateralOffered = typeof body.collateralOffered === "string" ? body.collateralOffered.trim().slice(0, 500) : "";
  const collateralValue = typeof body.collateralValue === "string" ? body.collateralValue.trim().slice(0, 100) : null;
  const previousLoans = typeof body.previousLoans === "string" && PREVIOUS_LOAN_OPTIONS.includes(body.previousLoans) ? body.previousLoans : null;
  const repaymentPlan = typeof body.repaymentPlan === "string" ? body.repaymentPlan.trim().slice(0, MAX_TEXT_LENGTH) : null;
  const additionalNotes = typeof body.additionalNotes === "string" ? body.additionalNotes.trim().slice(0, MAX_TEXT_LENGTH) : null;
  const gpAmount = loanType === "gp" && typeof body.gpAmount === "string" ? body.gpAmount.trim().slice(0, 50) : null;
  const itemDescription = loanType === "item" && typeof body.itemDescription === "string" ? body.itemDescription.trim().slice(0, 200) : null;
  const agreedTerms = body.agreedTerms === true;

  if (!LOAN_TIMEFRAMES.includes(timeframe)) {
    return NextResponse.json({ error: "Please select a valid timeframe." }, { status: 400 });
  }
  if (!collateralOffered) {
    return NextResponse.json({ error: "Please describe the collateral you're offering." }, { status: 400 });
  }
  if (loanType === "gp" && !gpAmount) {
    return NextResponse.json({ error: "Please enter the GP amount you're requesting." }, { status: 400 });
  }
  if (loanType === "item" && !itemDescription) {
    return NextResponse.json({ error: "Please describe the item you're requesting." }, { status: 400 });
  }
  if (!agreedTerms) {
    return NextResponse.json({ error: "You must agree to the Terms of Service." }, { status: 400 });
  }

  const { data: inserted, error } = await supabase
    .from("loan_requests")
    .insert({
      borrower_id: user.id,
      loan_type: loanType,
      gp_amount: gpAmount,
      item_description: itemDescription,
      timeframe,
      purpose,
      collateral_offered: collateralOffered,
      collateral_value: collateralValue,
      previous_loans: previousLoans,
      repayment_plan: repaymentPlan,
      additional_notes: additionalNotes,
      agreed_terms: agreedTerms,
    })
    .select("id")
    .single();

  if (error || !inserted) return NextResponse.json({ error: "Failed to submit loan request." }, { status: 500 });

  try {
    const channelId = await getAlertChannel(supabase, "loans");
    if (channelId) {
      const amount = loanType === "gp" ? gpAmount : itemDescription;
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://gn0mehome.com";
      await postToDestination(
        channelId,
        "New Loan Request",
        `💰 **New loan request** from ${eligibility.verifiedName} -- ${amount} for ${timeframe}\nView the board: ${siteUrl}/loans`
      );
    }
  } catch (err) {
    console.error("Loan request notification failed:", err);
  }

  return NextResponse.json({ id: inserted.id }, { status: 201 });
}
