import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getDiscordEvents } from "@/lib/discord";

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    // Fetch all scheduled events from Discord
    const discordEvents = await getDiscordEvents();

    if (!Array.isArray(discordEvents) || discordEvents.length === 0) {
      return NextResponse.json({ imported: 0, message: "No scheduled events found in Discord." });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Get existing discord_event_ids to avoid duplicates
    const { data: existing } = await supabase
      .from("events")
      .select("discord_event_id")
      .not("discord_event_id", "is", null);

    const existingIds = new Set((existing ?? []).map((e) => e.discord_event_id));

    // Filter to events not already imported
    const toImport = discordEvents.filter(
      (de: { id: string; status: number }) =>
        !existingIds.has(de.id) && de.status !== 4 // 4 = completed
    );

    if (toImport.length === 0) {
      return NextResponse.json({ imported: 0, message: "All Discord events already imported." });
    }

    const rows = toImport.map(
      (de: {
        id: string;
        name: string;
        description: string | null;
        scheduled_start_time: string;
        scheduled_end_time: string | null;
        entity_metadata?: { location?: string };
        creator?: { username: string; global_name?: string };
      }) => ({
        title: de.name,
        description: de.description ?? null,
        event_type: guessEventType(de.name, de.description),
        start_time: de.scheduled_start_time,
        end_time: de.scheduled_end_time ?? null,
        location: de.entity_metadata?.location ?? null,
        host_rsn: de.creator?.global_name ?? de.creator?.username ?? null,
        discord_event_id: de.id,
      })
    );

    const { error } = await supabase.from("events").insert(rows);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      imported: rows.length,
      message: `Imported ${rows.length} event(s) from Discord.`,
    });
  } catch (err) {
    console.error("Discord event import error:", err);
    return NextResponse.json(
      { error: "Failed to import from Discord. Check bot token and permissions." },
      { status: 500 }
    );
  }
}

function guessEventType(name: string, description: string | null): string {
  const text = `${name} ${description ?? ""}`.toLowerCase();
  if (text.includes("pvm") || text.includes("boss") || text.includes("raid") || text.includes("cox") || text.includes("tob") || text.includes("toa")) return "pvm";
  if (text.includes("skill") || text.includes("sotw") || text.includes("mining") || text.includes("woodcut")) return "skilling";
  if (text.includes("drop party") || text.includes("giveaway")) return "drop_party";
  if (text.includes("hide") || text.includes("seek")) return "hide_seek";
  if (text.includes("social") || text.includes("hangout") || text.includes("movie")) return "social";
  return "other";
}
