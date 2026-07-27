import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";

function normalizeRsn(s: string): string {
  return s.toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
}

// GET - names of everyone who attended events in a date range, with how
// many of those events each attended. Powers the admin "Attendance Export"
// tool (e.g. building a raffle wheel list) -- not the public leaderboard,
// so it's permission-gated even though the underlying data isn't secret.
export async function GET(request: NextRequest) {
  const { allowed } = await checkPermission("manage_events");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const startParam = request.nextUrl.searchParams.get("start");
  const endParam = request.nextUrl.searchParams.get("end");
  if (!startParam || !endParam) {
    return NextResponse.json({ error: "start and end are required" }, { status: 400 });
  }
  const start = new Date(startParam);
  const end = new Date(endParam);

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: events, error: eventsError } = await supabase
    .from("events")
    .select("id, title, start_time")
    .gte("start_time", start.toISOString())
    .lte("start_time", end.toISOString())
    .order("start_time", { ascending: true });

  if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 500 });

  const eventIds = (events ?? []).map((e) => e.id);

  let attendance: { rsn: string | null; discord_username: string | null; discord_nickname: string | null }[] = [];
  if (eventIds.length > 0) {
    const { data, error } = await supabase
      .from("event_attendance")
      .select("rsn, discord_username, discord_nickname")
      .eq("attended", true)
      .in("event_id", eventIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    attendance = data ?? [];
  }

  // Same normalized-RSN dedup as the leaderboard -- the same person can
  // otherwise show up twice under different discord ids.
  const counts = new Map<string, { name: string; count: number }>();
  for (const row of attendance) {
    const name = row.rsn ?? row.discord_nickname ?? row.discord_username ?? "Unknown";
    const key = row.rsn && row.rsn.trim() ? normalizeRsn(row.rsn) : `unnamed:${name}`;
    const existing = counts.get(key);
    if (existing) existing.count++;
    else counts.set(key, { name, count: 1 });
  }

  const attendees = Array.from(counts.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  return NextResponse.json({
    attendees,
    total_events: eventIds.length,
    events: (events ?? []).map((e) => ({ id: e.id, title: e.title, start_time: e.start_time })),
  });
}
