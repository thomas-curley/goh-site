import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET - public list of bingo boards. Draft boards aren't shown -- they're
// still being set up and may not have every tile/team finalized yet.
export async function GET() {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ events: [] });

  const { data, error } = await supabase
    .from("bingo_events")
    .select("id, name, description, banner_url, starts_at, ends_at, grid_size, status")
    .in("status", ["active", "completed"])
    .order("starts_at", { ascending: false, nullsFirst: false });

  if (error) return NextResponse.json({ error: "Failed to load bingo events." }, { status: 500 });
  return NextResponse.json({ events: data ?? [] });
}
