import { NextRequest, NextResponse } from "next/server";
import { questServiceClient, syncQuestEvent } from "@/lib/quest-server";

// Checking a whole clan on WikiSync can take a while.
export const maxDuration = 300;

// Quest event endpoint for the Discord bot (Bearer DISCORD_WEBHOOK_SECRET).
//   POST { action: "sync" }  checks WikiSync for every event with sign-ups
//                            open or live (skipping ones checked recently)

function authorized(request: NextRequest) {
  const secret = process.env.DISCORD_WEBHOOK_SECRET;
  return !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = questServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  if (body.action !== "sync") return NextResponse.json({ error: "Unknown action." }, { status: 400 });

  const { data: events } = await supabase.from("quest_events").select("id").in("status", ["signups", "active"]);
  let newQuests = 0;
  for (const e of events ?? []) newQuests += (await syncQuestEvent(supabase, e.id, { minAgeMinutes: 20 })).newQuests;
  return NextResponse.json({ events: (events ?? []).length, newQuests });
}
