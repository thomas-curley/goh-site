import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Captures a daily clan snapshot. Call this via cron job or manually.
 * Authenticated with DISCORD_WEBHOOK_SECRET.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.DISCORD_WEBHOOK_SECRET;
  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  try {
    // Fetch WOM group data
    const womRes = await fetch("https://api.wiseoldman.net/v2/groups/24582", {
      headers: { "User-Agent": "GnomeHome-Snapshots" },
    });
    const womData = womRes.ok ? await womRes.json() : null;
    const memberships = womData?.memberships ?? [];

    const memberCount = memberships.length;
    const totalExp = memberships.reduce((sum: number, m: { player: { exp: number } }) => sum + (m.player.exp ?? 0), 0);
    const totalEhp = memberships.reduce((sum: number, m: { player: { ehp: number } }) => sum + (m.player.ehp ?? 0), 0);
    const totalEhb = memberships.reduce((sum: number, m: { player: { ehb: number } }) => sum + (m.player.ehb ?? 0), 0);

    // Count registered users and linked RSNs
    const { count: registeredUsers } = await supabase
      .from("user_profiles")
      .select("*", { count: "exact", head: true });

    const { count: linkedRsns } = await supabase
      .from("user_profiles")
      .select("*", { count: "exact", head: true })
      .not("rsn", "is", null);

    // Count events this month
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const { count: eventsCount } = await supabase
      .from("events")
      .select("*", { count: "exact", head: true })
      .gte("start_time", monthStart.toISOString());

    const today = new Date().toISOString().split("T")[0];

    const { error } = await supabase
      .from("clan_snapshots")
      .upsert({
        date: today,
        member_count: memberCount,
        total_exp: totalExp,
        registered_users: registeredUsers ?? 0,
        linked_rsns: linkedRsns ?? 0,
        events_count: eventsCount ?? 0,
        total_ehp: Math.round(totalEhp),
        total_ehb: Math.round(totalEhb),
      }, { onConflict: "date" });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      captured: true,
      date: today,
      member_count: memberCount,
      total_exp: totalExp,
      registered_users: registeredUsers,
      linked_rsns: linkedRsns,
    });
  } catch (err) {
    console.error("Snapshot capture error:", err);
    return NextResponse.json({ error: "Failed to capture snapshot" }, { status: 500 });
  }
}
