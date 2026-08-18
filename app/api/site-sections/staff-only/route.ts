import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET - public: just the list of section keys currently toggled staff-only,
// for the Navbar to decide which nav links to hide. No sensitive data here
// (just which features are gated), so no permission check -- every visitor's
// browser needs this to render the right nav regardless of who they are.
export async function GET() {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ keys: [] });

  const { data } = await supabase.from("site_sections").select("key").eq("staff_only", true);
  return NextResponse.json({ keys: (data ?? []).map((row) => row.key) });
}
