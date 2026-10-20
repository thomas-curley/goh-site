import { NextRequest, NextResponse } from "next/server";
import { questServiceClient, syncQuestEvent } from "@/lib/quest-server";

/**
 * Daily fallback WikiSync check for quest events with sign-ups open or live
 * (see vercel.json). The bot checks every 30 minutes through
 * /api/bot/quests, and event pages check when someone opens them.
 * Requires CRON_SECRET if set.
 */
export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = questServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: events } = await supabase.from("quest_events").select("id").in("status", ["signups", "active"]);
  let checked = 0;
  let newQuests = 0;
  const errors: string[] = [];
  for (const e of events ?? []) {
    const r = await syncQuestEvent(supabase, e.id);
    checked += r.checked;
    newQuests += r.newQuests;
    errors.push(...r.errors);
  }
  return NextResponse.json({ events: (events ?? []).length, checked, newQuests, errors });
}
