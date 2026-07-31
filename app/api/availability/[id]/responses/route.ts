import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { checkClanEligibility } from "@/lib/clan-access";
import { slotsForPoll } from "@/lib/availability";
import { CLAN_TIMEZONE } from "@/lib/constants";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const MAX_NAME_LENGTH = 80;

// POST - submit a response. Fully public and anonymous by default, unless
// the poll's access_level requires a linked/verified RSN.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: poll } = await supabase.from("availability_polls").select("*").eq("id", id).maybeSingle();
  if (!poll) return NextResponse.json({ error: "Poll not found." }, { status: 404 });
  if (!poll.is_active) return NextResponse.json({ error: "This poll is closed." }, { status: 400 });

  const authClient = await createSupabaseServerClient();
  const { data: { user: authUser } } = await authClient.auth.getUser();
  const eligibility = await checkClanEligibility(supabase, poll.access_level, authUser?.id ?? null, "this availability poll");
  if (!eligibility.eligible) {
    return NextResponse.json({ error: eligibility.reason ?? "You are not eligible to respond to this poll." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const timezone = typeof body.timezone === "string" && body.timezone.trim() ? body.timezone.trim() : CLAN_TIMEZONE;

  // Only accept slots that are actually part of this poll's grid -- never
  // trust arbitrary client-supplied timestamps.
  const validSlots = new Set(slotsForPoll(poll.days, poll.start_minute, poll.end_minute, poll.slot_minutes, CLAN_TIMEZONE));
  const slots: string[] = Array.isArray(body.slots)
    ? Array.from(new Set(body.slots.filter((s: unknown) => typeof s === "string" && validSlots.has(s))))
    : [];

  if (slots.length === 0) {
    return NextResponse.json({ error: "Select at least one time slot." }, { status: 400 });
  }

  const gated = poll.access_level !== "anonymous";
  const respondentName = gated
    ? eligibility.verifiedName ?? null
    : (typeof body.respondentName === "string" ? body.respondentName.trim().slice(0, MAX_NAME_LENGTH) : "") || null;
  const discordId = gated ? eligibility.discordId ?? null : null;

  const { error } = await supabase.from("availability_responses").insert({
    poll_id: id,
    respondent_name: respondentName,
    discord_id: discordId,
    timezone,
    slots,
  });

  if (error) return NextResponse.json({ error: "Failed to submit response." }, { status: 500 });

  return NextResponse.json({ submitted: true });
}

// GET - list responses for the admin heatmap review.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { allowed } = await checkPermission("manage_availability");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("availability_responses")
    .select("*")
    .eq("poll_id", id)
    .order("submitted_at", { ascending: false });

  if (error) return NextResponse.json({ error: "Failed to load responses." }, { status: 500 });

  return NextResponse.json({ responses: data ?? [] });
}
