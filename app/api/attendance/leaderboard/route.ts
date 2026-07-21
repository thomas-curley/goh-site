import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function resolveRange(searchParams: URLSearchParams): { start: Date | null; end: Date | null } {
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  const period = searchParams.get("period");

  if (startParam || endParam) {
    return {
      start: startParam ? new Date(startParam) : null,
      end: endParam ? new Date(endParam) : null,
    };
  }

  if (period === "month") {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    return { start: monthAgo, end: null };
  }

  if (period === "week") {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return { start: weekAgo, end: null };
  }

  return { start: null, end: null };
}

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "20");
  const period = request.nextUrl.searchParams.get("period");
  const { start, end } = resolveRange(request.nextUrl.searchParams);

  const supabase = createClient(supabaseUrl, serviceKey);

  // Events in range — attendance is bucketed by when the event happened,
  // not by when an admin got around to marking it, so the leaderboard and
  // chart reflect the events themselves rather than data-entry timing.
  let eventsQuery = supabase
    .from("events")
    .select("id, title, start_time")
    .order("start_time", { ascending: true });
  if (start) eventsQuery = eventsQuery.gte("start_time", start.toISOString());
  if (end) eventsQuery = eventsQuery.lte("start_time", end.toISOString());

  const { data: events, error: eventsError } = await eventsQuery;
  if (eventsError) return NextResponse.json({ error: eventsError.message }, { status: 500 });

  const eventIds = (events ?? []).map((e) => e.id);

  let attendance: { event_id: string; discord_id: string; discord_username: string | null; discord_nickname: string | null; rsn: string | null }[] = [];
  if (eventIds.length > 0) {
    const { data, error } = await supabase
      .from("event_attendance")
      .select("event_id, discord_id, discord_username, discord_nickname, rsn")
      .eq("attended", true)
      .in("event_id", eventIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    attendance = data ?? [];
  }

  // Aggregate: count events attended per person
  const counts = new Map<string, { discord_id: string; name: string; rsn: string | null; count: number }>();
  for (const row of attendance) {
    const key = row.discord_id;
    const existing = counts.get(key);
    if (existing) {
      existing.count++;
    } else {
      counts.set(key, {
        discord_id: row.discord_id,
        name: row.discord_nickname ?? row.discord_username ?? "Unknown",
        rsn: row.rsn,
        count: 1,
      });
    }
  }

  const leaderboard = Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  // Per-event attendee counts, for charting attendance over time.
  const countByEvent = new Map<string, number>();
  for (const row of attendance) {
    countByEvent.set(row.event_id, (countByEvent.get(row.event_id) ?? 0) + 1);
  }
  const timeseries = (events ?? []).map((e) => ({
    event_id: e.id,
    title: e.title,
    start_time: e.start_time,
    attendee_count: countByEvent.get(e.id) ?? 0,
  }));

  return NextResponse.json({
    leaderboard,
    timeseries,
    total_events: eventIds.length,
    period: period ?? (start || end ? "custom" : "all"),
    start: start ? start.toISOString() : null,
    end: end ? end.toISOString() : null,
  });
}
