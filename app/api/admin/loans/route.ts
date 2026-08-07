import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET - every loan request regardless of status, for staff oversight.
export async function GET() {
  const { allowed } = await checkPermission("manage_loans");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("loan_requests")
    .select(`
      *,
      borrower:user_profiles!loan_requests_borrower_id_fkey(discord_username, rsn),
      lender:user_profiles!loan_requests_lender_id_fkey(discord_username, rsn)
    `)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Failed to load loans." }, { status: 500 });

  return NextResponse.json({ loans: data ?? [] });
}
