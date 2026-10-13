import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { refreshClanRankings } from "@/lib/clan-rankings";

// ~85 WOM group-hiscores calls, 8 at a time.
export const maxDuration = 60;

/**
 * Daily refresh of every member's clan rank per skill/boss/EHP/EHB for the
 * member profiles beta (see vercel.json). Requires CRON_SECRET if set.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const result = await refreshClanRankings(createClient(url, key));
  return NextResponse.json(result);
}
