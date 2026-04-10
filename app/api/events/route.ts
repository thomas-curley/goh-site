import { NextRequest, NextResponse } from "next/server";

// Placeholder: events will be stored in Supabase once credentials are configured.
// For now, return empty array / accept creation requests gracefully.

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("start");
  const endDate = searchParams.get("end");

  // TODO: Fetch from Supabase with date range filter
  // const supabase = getSupabaseClient();
  // let query = supabase.from("events").select("*").order("start_time", { ascending: true });
  // if (startDate) query = query.gte("start_time", startDate);
  // if (endDate) query = query.lte("start_time", endDate);

  return NextResponse.json({ events: [], message: "Supabase not configured yet" });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.title || !body.start_time) {
      return NextResponse.json(
        { error: "title and start_time are required" },
        { status: 400 }
      );
    }

    // TODO: Authenticate user (must be Council/Summoner Hat rank)
    // TODO: Save to Supabase
    // TODO: Create Discord Scheduled Event via Discord API

    return NextResponse.json(
      { message: "Event creation will work once Supabase is configured", event: body },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
