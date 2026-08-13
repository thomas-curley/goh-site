import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { WEEKDAYS } from "@/lib/availability";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export interface WeekdayAvailability {
  weekday: string;
  count: number;
  members: { rsn: string | null; discordUsername: string }[];
}

// GET - clan-wide standing weekly availability, bucketed by weekday. Sourced
// from user_profiles.available_weekdays (set on /account), not tied to any
// poll -- only verified clan members count, same as other admin views.
export async function GET() {
  const { allowed } = await checkPermission("manage_availability");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("user_profiles")
    .select("rsn, discord_username, available_weekdays")
    .eq("rsn_verified", true);

  if (error) return NextResponse.json({ error: "Failed to load availability." }, { status: 500 });

  const profiles = data ?? [];
  const byWeekday = new Map<string, { rsn: string | null; discordUsername: string }[]>(
    WEEKDAYS.map((day) => [day, []])
  );

  let respondedCount = 0;
  for (const profile of profiles) {
    const days = profile.available_weekdays ?? [];
    if (days.length === 0) continue;
    respondedCount++;
    for (const day of days) {
      byWeekday.get(day)?.push({ rsn: profile.rsn, discordUsername: profile.discord_username });
    }
  }

  const weekdays: WeekdayAvailability[] = WEEKDAYS.map((day) => ({
    weekday: day,
    count: byWeekday.get(day)?.length ?? 0,
    members: byWeekday.get(day) ?? [],
  }));

  return NextResponse.json({ weekdays, respondedCount, totalLinked: profiles.length });
}
