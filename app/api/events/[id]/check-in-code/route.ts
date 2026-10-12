import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { checkClanEligibility } from "@/lib/clan-access";
import { randomCheckInWord } from "@/lib/checkin-words";

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

// POST - set the code from the quick control (calendar pop-up, attendance
// page): { action: "generate" } picks a fresh random word, { action: "clear" }
// goes back to code-free check-in. Same staff gate as GET -- whoever can see
// the code at an event can rotate it there, without opening the full edit form.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();

  const eligibility = await checkClanEligibility(supabase, "staff", user?.id ?? null, "the check-in code");
  if (!eligibility.eligible) {
    return NextResponse.json({ error: eligibility.reason ?? "Staff only." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  if (body.action !== "generate" && body.action !== "clear") {
    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  }
  const code = body.action === "generate" ? randomCheckInWord() : null;

  const { data, error } = await supabase.from("events").update({ check_in_code: code }).eq("id", id).select("id").maybeSingle();
  if (error) return NextResponse.json({ error: "Failed to update the code." }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Event not found." }, { status: 404 });

  return NextResponse.json({ code });
}
