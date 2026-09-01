import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { isSectionVisible } from "@/lib/clan-access";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET - every loan the caller is involved in, as borrower or lender.
export async function GET() {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "You must be signed in." }, { status: 401 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  // Same section-visibility gate every other /api/loans route already
  // enforces -- this one was missing it, letting a rank with Bank hidden
  // still read their own loan history directly.
  if (!(await isSectionVisible(supabase, "bank", user.id))) {
    return NextResponse.json({ error: "This section isn't available to you right now." }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("loan_requests")
    .select(`
      *,
      borrower:user_profiles!loan_requests_borrower_id_fkey(discord_username, rsn),
      lender:user_profiles!loan_requests_lender_id_fkey(discord_username, rsn)
    `)
    .or(`borrower_id.eq.${user.id},lender_id.eq.${user.id}`)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Failed to load your loans." }, { status: 500 });

  return NextResponse.json({
    requested: (data ?? []).filter((l) => l.borrower_id === user.id),
    funding: (data ?? []).filter((l) => l.lender_id === user.id),
  });
}
