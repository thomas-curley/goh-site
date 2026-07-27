import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const VALID_TYPES = ["Bossing", "Skilling", "PvP", "Social"];
const VALID_SUBTYPES = ["None", "Mass", "Wilderness", "Risky", "Serious", "Chill", "Meta", "Competition", "Rewards", "Bingo"];
const MAX_TEXT_LENGTH = 100;

// PATCH - save the admin's manually-entered translation of this event into
// the fields OSRS's in-game "Clan Home: Events" form expects. Purely a
// bookkeeping helper -- never synced anywhere, never shown publicly.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { allowed } = await checkPermission("manage_events");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const update: Record<string, unknown> = {};

  if (body.osrsType === null || VALID_TYPES.includes(body.osrsType)) {
    update.osrs_type = body.osrsType ?? null;
  }
  if (body.osrsSubtype === null || VALID_SUBTYPES.includes(body.osrsSubtype)) {
    update.osrs_subtype = body.osrsSubtype ?? null;
  }
  if (typeof body.osrsActivity === "string") {
    update.osrs_activity = body.osrsActivity.trim().slice(0, MAX_TEXT_LENGTH) || null;
  }
  if (typeof body.osrsJoinRank === "string") {
    update.osrs_join_rank = body.osrsJoinRank.trim().slice(0, MAX_TEXT_LENGTH) || null;
  }
  if (body.osrsDurationDays === null) {
    update.osrs_duration_days = null;
  } else if (typeof body.osrsDurationDays === "number" && Number.isFinite(body.osrsDurationDays)) {
    update.osrs_duration_days = Math.max(1, Math.round(body.osrsDurationDays));
  }
  if (typeof body.osrsAddedIngame === "boolean") {
    update.osrs_added_ingame = body.osrsAddedIngame;
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "No valid fields to update." }, { status: 400 });
  }

  const { error } = await supabase.from("events").update(update).eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to save." }, { status: 500 });

  return NextResponse.json({ updated: true });
}
