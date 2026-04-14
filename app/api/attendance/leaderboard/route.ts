import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const limit = parseInt(request.nextUrl.searchParams.get("limit") ?? "20");
  const period = request.nextUrl.searchParams.get("period"); // optional: "month", "all"

  const supabase = createClient(supabaseUrl, serviceKey);

  // Build query — count events attended per person
  let query = supabase
    .from("event_attendance")
    .select("discord_id, discord_username, discord_nickname, rsn")
    .eq("attended", true);

  // Optional period filter
  if (period === "month") {
    const monthAgo = new Date();
    monthAgo.setMonth(monthAgo.getMonth() - 1);
    query = query.gte("noted_at", monthAgo.toISOString());
  } else if (period === "week") {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    query = query.gte("noted_at", weekAgo.toISOString());
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Aggregate: count events per person
  const counts = new Map<string, { discord_id: string; name: string; rsn: string | null; count: number }>();
  for (const row of data ?? []) {
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

  // Sort by count descending
  const leaderboard = Array.from(counts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  return NextResponse.json({
    leaderboard,
    total_events: new Set((data ?? []).map((r) => r.discord_id)).size ? data?.length : 0,
    period: period ?? "all",
  });
}
