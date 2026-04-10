import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Webhook endpoint for Discord bot to push event updates
export async function POST(request: NextRequest) {
  // Verify shared secret
  const authHeader = request.headers.get("authorization");
  const webhookSecret = process.env.DISCORD_WEBHOOK_SECRET;

  if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();
    const { action, event } = body;

    switch (action) {
      case "create": {
        const { data, error } = await supabase
          .from("events")
          .upsert(
            {
              title: event.title,
              description: event.description,
              start_time: event.start_time ?? event.scheduled_start_time,
              end_time: event.end_time ?? event.scheduled_end_time,
              discord_event_id: event.discord_event_id ?? event.id,
              event_type: event.event_type ?? "other",
              location: event.location,
            },
            { onConflict: "discord_event_id" }
          )
          .select()
          .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ event: data });
      }

      case "update": {
        const discordId = event.discord_event_id ?? event.id;
        const { data, error } = await supabase
          .from("events")
          .update({
            title: event.title,
            description: event.description,
            start_time: event.start_time ?? event.scheduled_start_time,
            end_time: event.end_time ?? event.scheduled_end_time,
            location: event.location,
            updated_at: new Date().toISOString(),
          })
          .eq("discord_event_id", discordId)
          .select()
          .single();

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ event: data });
      }

      case "delete": {
        const discordId = event.discord_event_id ?? event.id;
        const { error } = await supabase
          .from("events")
          .delete()
          .eq("discord_event_id", discordId);

        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        return NextResponse.json({ deleted: true });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
