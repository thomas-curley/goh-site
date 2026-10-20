import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/check-permission";
import { questServiceClient } from "@/lib/quest-server";

// GET ?status=pending|approved|rejected&eventId= - quest screenshots for the
// review queue, oldest first for pending and newest first otherwise.
export async function GET(request: NextRequest) {
  const { allowed } = await checkPermission("manage_quests");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = questServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const param = request.nextUrl.searchParams.get("status") ?? "";
  const status = ["pending", "approved", "rejected"].includes(param) ? param : "pending";
  const eventId = request.nextUrl.searchParams.get("eventId");
  let query = supabase
    .from("quest_event_submissions")
    .select("id, event_id, participant_id, quest_name, image_urls, note, source, status, reviewed_by, reviewed_at, review_note, created_at, quest_events(name), quest_event_participants(rsn, has_wikisync, quest_event_teams(name, color))")
    .eq("status", status)
    .order("created_at", { ascending: status === "pending" })
    .limit(200);
  if (eventId) query = query.eq("event_id", eventId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load submissions." }, { status: 500 });
  return NextResponse.json({ submissions: data ?? [] });
}
