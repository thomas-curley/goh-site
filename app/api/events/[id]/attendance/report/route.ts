import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { postToChannel } from "@/lib/discord";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// POST - build an attendance report for an event and post it to a Discord channel.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { channelId } = await request.json().catch(() => ({}));
  if (!channelId) {
    return NextResponse.json({ error: "channelId required" }, { status: 400 });
  }

  const { data: event } = await supabase
    .from("events")
    .select("title, start_time")
    .eq("id", id)
    .single();
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { data: attendance } = await supabase
    .from("event_attendance")
    .select("rsn, discord_username, discord_nickname, attended")
    .eq("event_id", id)
    .eq("attended", true)
    .order("rsn", { ascending: true });

  const attendees = attendance ?? [];
  const names = attendees.map((a) => a.rsn ?? a.discord_nickname ?? a.discord_username ?? "Unknown");

  const dateStr = new Date(event.start_time).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const message = [
    `📋 **Attendance Report — ${event.title}**`,
    `🗓️ ${dateStr}`,
    "",
    names.length > 0
      ? `✅ **${names.length} Attended:**`
      : "No attendance recorded for this event yet.",
    ...names.map((n) => `• ${n}`),
    names.length > 0 ? "" : null,
    names.length > 0 ? "🎟️ These members are eligible for this week's raffle!" : null,
  ].filter((line) => line !== null).join("\n");

  try {
    const result = await postToChannel(channelId, message);
    return NextResponse.json({ posted: true, message_id: result.id, count: names.length });
  } catch (err) {
    console.error("Attendance report post error:", err);
    return NextResponse.json({ error: "Failed to post to Discord" }, { status: 500 });
  }
}
