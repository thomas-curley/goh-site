import { NextRequest, NextResponse } from "next/server";
import { bingoServiceClient } from "@/lib/bingo-server";
import { syncEventAutoTiles } from "@/lib/bingo-sync";

/**
 * Daily fallback sync of every live board's auto-tracked tiles (see
 * vercel.json). The bot refreshes live boards more often through
 * /api/bot/bingo, and boards also refresh when someone opens them.
 * Requires CRON_SECRET if set.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = bingoServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: events } = await supabase.from("bingo_events").select("id").eq("status", "active");
  let totalTilesSynced = 0;
  const errors: string[] = [];
  for (const event of events ?? []) {
    const result = await syncEventAutoTiles(supabase, event.id);
    totalTilesSynced += result.tilesSynced;
    errors.push(...result.errors);
  }
  return NextResponse.json({ eventsSynced: (events ?? []).length, totalTilesSynced, errors });
}
