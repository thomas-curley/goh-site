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
// ping roles, raffle amount, last-posted competitions) plus the clan's
// recent/upcoming WOM competitions for the turnover form's pickers.
export async function GET() {
  const { allowed } = await checkPermission("manage_competitions");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase.from("weekly_competition_config").select("*").eq("id", 1).maybeSingle();
  if (error || !data) return NextResponse.json({ error: "Failed to load weekly competition config." }, { status: 500 });

  const competitions = await getPickableCompetitions();
  return NextResponse.json({ config: data, competitions });
}
