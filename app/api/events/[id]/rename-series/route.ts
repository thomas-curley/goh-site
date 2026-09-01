import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { updateDiscordEvent } from "@/lib/discord";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const MAX_TITLE_LENGTH = 100;

/**
 * POST /api/events/[id]/rename-series -- renames every reference to the
 * recurring series this occurrence belongs to (identified by its shared
 * discord_event_id):
 *   - the Discord scheduled event itself, so occurrences the daily import
 *     materializes later carry the new name instead of re-diverging;
 *   - this and every upcoming site occurrence (start_time >= now). Past
 *     occurrences deliberately keep the name they had when they happened,
 *     so attendance and payout history still reads the way it did then;
 *   - series_update_posts.series_title for the series, since those are
 *     references to the series as a whole rather than to one occurrence.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { allowed } = await checkPermission("manage_events");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === "string" ? body.title.trim().slice(0, MAX_TITLE_LENGTH) : "";
  if (!title) return NextResponse.json({ error: "Enter a new title." }, { status: 400 });

  const { data: event } = await supabase
    .from("events")
    .select("id, discord_event_id")
    .eq("id", id)
    .maybeSingle();
  if (!event) return NextResponse.json({ error: "Event not found." }, { status: 404 });
  if (!event.discord_event_id) {
    return NextResponse.json({ error: "This event isn't part of a recurring series." }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const { data: renamed, error } = await supabase
    .from("events")
    .update({ title, updated_at: nowIso })
    .eq("discord_event_id", event.discord_event_id)
    .gte("start_time", nowIso)
    .select("id");
  if (error) return NextResponse.json({ error: "Failed to rename occurrences." }, { status: 500 });

  const { error: postsError } = await supabase
    .from("series_update_posts")
    .update({ series_title: title, updated_at: nowIso })
    .eq("discord_event_id", event.discord_event_id);
  if (postsError) console.error("Series update posts rename failed:", postsError);

  let discordRenamed = false;
  try {
    await updateDiscordEvent(event.discord_event_id, { name: title });
    discordRenamed = true;
  } catch (err) {
    // Non-fatal -- the site rows are already renamed; the admin just needs
    // to know the next imported occurrence may still carry the old name.
    console.error("Discord series rename failed:", err);
  }

  return NextResponse.json({ renamed: renamed?.length ?? 0, discordRenamed });
}
