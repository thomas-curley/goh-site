import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { getCompetitionLeaders } from "@/lib/wom";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET ?competitionId=<wom_competitions.id> - fetches a competition's top
// finishers from WOM for the "Add Winners" form to auto-fill RSN rows when
// staff pick a closed competition, instead of typing names in by hand.
export async function GET(request: NextRequest) {
  const { allowed } = await checkPermission("manage_payouts");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const competitionId = request.nextUrl.searchParams.get("competitionId");
  if (!competitionId) return NextResponse.json({ error: "competitionId is required." }, { status: 400 });

  const { data: comp } = await supabase
    .from("wom_competitions")
    .select("wom_id, ends_at, payout_winner_count")
    .eq("id", competitionId)
    .maybeSingle();

  if (!comp) return NextResponse.json({ error: "Competition not found." }, { status: 404 });

  const isEnded = new Date(comp.ends_at) <= new Date();
  const leaders = isEnded ? await getCompetitionLeaders(comp.wom_id, comp.payout_winner_count || 3) : [];

  return NextResponse.json({ leaders, isEnded });
}
