import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { checkClanEligibility } from "@/lib/clan-access";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET - the event's check-in code, staff only. Deliberately never included
// in the public calendar/events payload (that's rendered for every visitor,
// staff or not) -- fetched on demand here instead, so the code stays
// restricted to staff the same way it's restricted to attendees who were
// actually told it in person.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();

  const eligibility = await checkClanEligibility(supabase, "staff", user?.id ?? null, "the check-in code");
  if (!eligibility.eligible) {
    return NextResponse.json({ error: eligibility.reason ?? "Staff only." }, { status: 403 });
  }

  const { data: event } = await supabase
    .from("events")
    .select("check_in_code")
    .eq("id", id)
    .maybeSingle();

  if (!event) {
    return NextResponse.json({ error: "Event not found." }, { status: 404 });
  }

  return NextResponse.json({ code: event.check_in_code ?? null });
}
