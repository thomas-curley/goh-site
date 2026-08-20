import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncEventWomTiles } from "@/lib/bingo-sync";

/**
 * Daily sync of every active bingo event's WOM-tracked tiles (see
 * vercel.json). Requires CRON_SECRET if set, same pattern as
 * /api/snapshots/capture -- there's no user session on a cron-triggered
 * request. Staleness between runs is expected (see the plan's WOM sync
 * pitfall); the admin "Refresh Now" button (/api/admin/bingo/[id]/refresh)
 * covers the gap for anyone who wants fresher numbers sooner.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: events } = await supabase.from("bingo_events").select("id").eq("status", "active");

  let totalTilesSynced = 0;
  const errors: string[] = [];
  for (const event of events ?? []) {
    const result = await syncEventWomTiles(supabase, event.id);
    totalTilesSynced += result.tilesSynced;
    errors.push(...result.errors);
  }

  return NextResponse.json({ eventsSynced: (events ?? []).length, totalTilesSynced, errors });
}
