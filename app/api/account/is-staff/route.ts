import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { checkClanEligibility } from "@/lib/clan-access";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET - whether the caller is currently Staff rank (Oak+). UI-convenience
// only (nav-item visibility) -- every staff-gated page still runs its own
// server-side checkClanEligibility, this doesn't replace that.
export async function GET() {
  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ isStaff: false });

  const eligibility = await checkClanEligibility(supabase, "staff", user?.id ?? null, "this");
  return NextResponse.json({ isStaff: eligibility.eligible });
}
