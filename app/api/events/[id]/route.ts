import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { updateDiscordEvent, deleteDiscordEvent } from "@/lib/discord";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();

    // Update in Supabase
    const { data, error } = await supabase
      .from("events")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sync to Discord if event has a linked Discord event
    if (data.discord_event_id) {
      try {
        await updateDiscordEvent(data.discord_event_id, {
          name: data.title,
          description: data.description ?? undefined,
          scheduled_start_time: data.start_time,
          scheduled_end_time: data.end_time ?? undefined,
          entity_type: 3,
          entity_metadata: {
            location: [data.location, data.meet_location].filter(Boolean).join(" — Meet: ") || "In-game",
          },
          privacy_level: 2,
        });
      } catch (discordErr) {
        console.error("Discord event update failed:", discordErr);
      }
    }

    return NextResponse.json({ event: data });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  // Get event first to check for Discord event ID
  const { data: event } = await supabase
    .from("events")
    .select("discord_event_id")
    .eq("id", id)
    .single();

  // Delete from Supabase
  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Delete from Discord if linked
  if (event?.discord_event_id) {
    try {
      await deleteDiscordEvent(event.discord_event_id);
    } catch (discordErr) {
      console.error("Discord event delete failed:", discordErr);
    }
  }

  return NextResponse.json({ deleted: true });
}
