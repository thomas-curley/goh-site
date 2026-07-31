import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { checkClanEligibility, type AccessLevel } from "@/lib/clan-access";
import { WEEKDAYS } from "@/lib/availability";

const VALID_ACCESS_LEVELS: AccessLevel[] = ["anonymous", "verified_player", "clan_member"];
const MAX_DAYS = 31;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET - a single poll, public (for the response page). Includes an
// eligibility preview for the caller's current session, same pattern as
// the survey take page -- the responses POST route re-checks this for
// real, this is just a heads-up.
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: poll } = await supabase.from("availability_polls").select("*").eq("id", id).maybeSingle();
  if (!poll) return NextResponse.json({ error: "Poll not found." }, { status: 404 });

  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  const eligibility = await checkClanEligibility(supabase, poll.access_level, user?.id ?? null, "this availability poll");

  return NextResponse.json({ poll, eligibility });
}

// PATCH - toggle active/closed, or edit title/description/days/window.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { allowed } = await checkPermission("manage_availability");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: existing } = await supabase.from("availability_polls").select("mode").eq("id", id).maybeSingle();
  if (!existing) return NextResponse.json({ error: "Poll not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.isActive === "boolean") update.is_active = body.isActive;
  if (typeof body.accessLevel === "string" && VALID_ACCESS_LEVELS.includes(body.accessLevel as AccessLevel)) {
    update.access_level = body.accessLevel;
  }
  if (typeof body.title === "string") {
    const title = body.title.trim();
    if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
    update.title = title;
  }
  if (typeof body.description === "string") {
    update.description = body.description.trim() || null;
  }
  // Mode itself isn't editable after creation (switching would orphan
  // existing responses, whose slot ids are shaped differently per mode) --
  // only the day list for whichever mode this poll already is.
  if (existing.mode === "dates" && Array.isArray(body.days)) {
    const days = Array.from(new Set(body.days.filter((d: unknown) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)))).sort();
    if (days.length === 0 || days.length > MAX_DAYS) {
      return NextResponse.json({ error: `Pick between 1 and ${MAX_DAYS} days.` }, { status: 400 });
    }
    update.days = days;
  }
  if (existing.mode === "weekly" && Array.isArray(body.weekdays)) {
    const weekdays = Array.from(new Set(body.weekdays.filter((w: unknown) => typeof w === "string" && WEEKDAYS.includes(w))));
    if (weekdays.length === 0) {
      return NextResponse.json({ error: "Pick at least one day of the week." }, { status: 400 });
    }
    update.weekdays = weekdays;
  }
  if (body.startMinute !== undefined || body.endMinute !== undefined) {
    const startMinute = Number(body.startMinute);
    const endMinute = Number(body.endMinute);
    if (!Number.isInteger(startMinute) || !Number.isInteger(endMinute) || startMinute < 0 || endMinute > 1440 || endMinute <= startMinute) {
      return NextResponse.json({ error: "Invalid start/end time." }, { status: 400 });
    }
    update.start_minute = startMinute;
    update.end_minute = endMinute;
  }
  if ([15, 30, 60].includes(Number(body.slotMinutes))) {
    update.slot_minutes = Number(body.slotMinutes);
  }

  const { error } = await supabase.from("availability_polls").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to update poll." }, { status: 500 });

  return NextResponse.json({ updated: true });
}

// DELETE - remove a poll and its responses (cascade).
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { allowed } = await checkPermission("manage_availability");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { error } = await supabase.from("availability_polls").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to delete poll." }, { status: 500 });

  return NextResponse.json({ deleted: true });
}
