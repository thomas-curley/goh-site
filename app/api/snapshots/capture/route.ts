import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeRsn } from "@/lib/wom";

/**
 * Captures a daily clan snapshot. Triggered two ways:
 * - GET, by Vercel Cron (see vercel.json) — requires CRON_SECRET if set,
 *   since there's no user session on a cron-triggered request.
 * - POST, by the "Capture Snapshot" button on /admin — no extra secret
 *   needed, since the /admin layout already gates that page server-side.
 */
async function runCapture() {
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

    // Re-sync clan_rank for every linked+verified profile against WOM's
    // current group role. clan_rank previously only got written once, at
    // RSN-link time -- an in-game promotion/demotion that WOM later picked
    // up never reached the site until the member re-linked their RSN.
    let ranksSynced = 0;
    const { data: linkedProfiles } = await supabase
      .from("user_profiles")
      .select("id, rsn, clan_rank")
      .eq("rsn_verified", true)
      .not("rsn", "is", null);

    if (linkedProfiles && linkedProfiles.length > 0) {
      const roleByRsn = new Map<string, string>(
        memberships
          .filter((m: { player: { displayName: string }; role: string }) => m.player?.displayName && m.role)
          .map((m: { player: { displayName: string }; role: string }) => [normalizeRsn(m.player.displayName), m.role])
      );

      for (const profile of linkedProfiles) {
        if (!profile.rsn) continue;
        const currentRole = roleByRsn.get(normalizeRsn(profile.rsn));
        if (currentRole && currentRole !== profile.clan_rank) {
          await supabase
            .from("user_profiles")
            .update({ clan_rank: currentRole, updated_at: new Date().toISOString() })
            .eq("id", profile.id);
          ranksSynced++;
        }
      }
    }

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
      ranks_synced: ranksSynced,
    });
  } catch (err) {
    console.error("Snapshot capture error:", err);
    return NextResponse.json({ error: "Failed to capture snapshot" }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  return runCapture();
}

export async function POST() {
  return runCapture();
}
