import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { pollDroptracker } from "@/lib/droptracker";

export const maxDuration = 300;

// POST - the bot asks every 5 minutes; the site reads DropTracker's drop
// feed if a bingo is live (Bearer DISCORD_WEBHOOK_SECRET).
export async function POST(request: NextRequest) {
  const secret = process.env.DISCORD_WEBHOOK_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  return NextResponse.json(await pollDroptracker(createClient(url, key)));
}
