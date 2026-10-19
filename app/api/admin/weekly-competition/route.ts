import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { getPickableCompetitions } from "@/lib/weekly-turnover";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET - the singleton weekly-competition config row (remembered thread,
// ping roles, raffle amount, last-posted competitions), the clan's
// recent/upcoming WOM competitions for the turnover form's pickers, and the
// most recent raffle with its winners (made on the Raffles page) so the
// raffle post can be filled in from it.
export async function GET() {
  const { allowed } = await checkPermission("manage_competitions");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase.from("weekly_competition_config").select("*").eq("id", 1).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Failed to load weekly competition config." }, { status: 500 });

  const [competitions, { data: raffle }] = await Promise.all([
    getPickableCompetitions(),
    supabase.from("raffles").select("id, title, occurred_on").order("occurred_on", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  let latestRaffle = null;
  if (raffle) {
    const { data: winners } = await supabase.from("prize_payouts").select("recipient_rsn, prize").eq("raffle_id", raffle.id).order("created_at");
    latestRaffle = { ...raffle, winners: (winners ?? []).map((w) => ({ rsn: w.recipient_rsn, prize: w.prize })) };
  }
  return NextResponse.json({ config: data, competitions, latestRaffle });
}
