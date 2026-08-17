import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { getCompetitionLeaders, normalizeRsn } from "@/lib/wom";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Deep enough to cover "top 10 pays, several decline in a row" without
// repeated round-trips -- WOM's per-competition call is cheap either way.
const LOOKAHEAD = 30;

// GET - for a competition-linked payout entry, suggests the next-placed
// finisher not already claimed by another payout entry for that same
// competition (including this row's own current recipient, so re-rolling
// the same entry a second time correctly skips past whoever just declined).
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { allowed } = await checkPermission("manage_payouts");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: payout } = await supabase
    .from("prize_payouts")
    .select("wom_competition_id")
    .eq("id", id)
    .maybeSingle();

  if (!payout?.wom_competition_id) {
    return NextResponse.json({ error: "This entry isn't linked to a competition." }, { status: 400 });
  }

  const { data: comp } = await supabase
    .from("wom_competitions")
    .select("wom_id")
    .eq("id", payout.wom_competition_id)
    .maybeSingle();

  if (!comp) return NextResponse.json({ error: "Linked competition not found." }, { status: 404 });

  const { data: existingPayouts } = await supabase
    .from("prize_payouts")
    .select("recipient_rsn")
    .eq("wom_competition_id", payout.wom_competition_id);

  const claimed = new Set((existingPayouts ?? []).map((p) => normalizeRsn(p.recipient_rsn)));

  const leaders = await getCompetitionLeaders(comp.wom_id, LOOKAHEAD);
  const next = leaders.find((l) => !claimed.has(normalizeRsn(l.displayName)));

  return NextResponse.json({ suggestedRsn: next?.displayName ?? null });
}
