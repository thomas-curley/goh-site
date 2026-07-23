import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGroupMembers, getGroupGains } from "@/lib/wom";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function resolveRange(searchParams: URLSearchParams): { start: Date; end: Date } {
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  const period = searchParams.get("period") ?? "month";

  const end = endParam ? new Date(endParam) : new Date();

  if (startParam) return { start: new Date(startParam), end };

  const start = new Date(end);
  if (period === "week") {
    start.setDate(start.getDate() - 7);
  } else if (period === "all") {
    // WOM has no canned "all time" gains period — go back far enough that
    // it's effectively the group's whole history.
    start.setFullYear(start.getFullYear() - 10);
  } else {
    start.setMonth(start.getMonth() - 1);
  }
  return { start, end };
}

/** WOM usernames/RSNs vary in spacing/casing (e.g. "gn0me_vlad" vs "Gn0me Vlad") — normalize before matching. */
function normalizeRsn(s: string): string {
  return s.toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
}

export type Focus = "skiller" | "bosser" | "balanced" | "inactive";

export interface ActivityMember {
  username: string;
  displayName: string;
  clanRole: string;
  linked: boolean;
  discordUsername: string | null;
  registeredAt: string;
  isNew: boolean;
  lastChangedAt: string | null;
  daysSinceActive: number | null;
  ehpGained: number;
  ehbGained: number;
  focus: Focus;
  eventsAttended: number;
}

export async function GET(request: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { start, end } = resolveRange(request.nextUrl.searchParams);

  const [members, ehpGains, ehbGains, profilesRes, attendanceRes] = await Promise.all([
    getGroupMembers(),
    getGroupGains("ehp", start, end),
    getGroupGains("ehb", start, end),
    supabase.from("user_profiles").select("discord_id, discord_username, rsn"),
    supabase
      .from("event_attendance")
      .select("rsn")
      .eq("attended", true)
      .gte("noted_at", start.toISOString())
      .lte("noted_at", end.toISOString()),
  ]);

  const ehpMap = new Map(ehpGains.map((g) => [normalizeRsn(g.displayName), g.gained]));
  const ehbMap = new Map(ehbGains.map((g) => [normalizeRsn(g.displayName), g.gained]));

  const profiles = profilesRes.data ?? [];
  const profileByRsn = new Map(
    profiles.filter((p) => p.rsn).map((p) => [normalizeRsn(p.rsn as string), p])
  );

  const attendance = attendanceRes.data ?? [];
  const attendanceCountByRsn = new Map<string, number>();
  for (const row of attendance) {
    if (!row.rsn) continue;
    const key = normalizeRsn(row.rsn);
    attendanceCountByRsn.set(key, (attendanceCountByRsn.get(key) ?? 0) + 1);
  }

  const now = Date.now();

  const rows: ActivityMember[] = members.map((m) => {
    const key = normalizeRsn(m.displayName);
    const ehpGained = ehpMap.get(key) ?? 0;
    const ehbGained = ehbMap.get(key) ?? 0;
    const profile = profileByRsn.get(key);
    const daysSinceActive = m.lastChangedAt ? Math.floor((now - new Date(m.lastChangedAt).getTime()) / 86400000) : null;

    let focus: Focus;
    if (ehpGained === 0 && ehbGained === 0) focus = "inactive";
    else if (ehpGained > ehbGained * 1.5) focus = "skiller";
    else if (ehbGained > ehpGained * 1.5) focus = "bosser";
    else focus = "balanced";

    return {
      username: m.username,
      displayName: m.displayName,
      clanRole: m.role,
      linked: !!profile,
      discordUsername: profile?.discord_username ?? null,
      registeredAt: m.registeredAt,
      isNew: new Date(m.registeredAt).getTime() >= start.getTime(),
      lastChangedAt: m.lastChangedAt,
      daysSinceActive,
      ehpGained,
      ehbGained,
      focus,
      eventsAttended: attendanceCountByRsn.get(key) ?? 0,
    };
  });

  const summary = {
    totalMembers: rows.length,
    activeCount: rows.filter((r) => r.focus !== "inactive").length,
    inactiveCount: rows.filter((r) => r.focus === "inactive").length,
    newMembers: rows.filter((r) => r.isNew).length,
    linkedCount: rows.filter((r) => r.linked).length,
    skillerCount: rows.filter((r) => r.focus === "skiller").length,
    bosserCount: rows.filter((r) => r.focus === "bosser").length,
    balancedCount: rows.filter((r) => r.focus === "balanced").length,
    uniqueAttendees: attendanceCountByRsn.size,
    attendanceRows: attendance.length,
  };

  return NextResponse.json({
    members: rows,
    summary,
    start: start.toISOString(),
    end: end.toISOString(),
  });
}
