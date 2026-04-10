import { NextRequest, NextResponse } from "next/server";

// Webhook endpoint for Discord bot to push event updates
export async function POST(request: NextRequest) {
  // Verify shared secret
  const authHeader = request.headers.get("authorization");
  const webhookSecret = process.env.DISCORD_WEBHOOK_SECRET;

  if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { action, event } = body;

    // action: "create" | "update" | "delete"
    // event: { discord_event_id, title, description, start_time, end_time, ... }

    switch (action) {
      case "create":
        // TODO: Upsert event in Supabase with discord_event_id
        return NextResponse.json({ message: "Event sync (create) received", event });

      case "update":
        // TODO: Update event in Supabase by discord_event_id
        return NextResponse.json({ message: "Event sync (update) received", event });

      case "delete":
        // TODO: Delete event in Supabase by discord_event_id
        return NextResponse.json({ message: "Event sync (delete) received", event });

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
