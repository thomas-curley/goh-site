import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/check-permission";
import { bingoServiceClient } from "@/lib/bingo-server";

// GET ?status=pending|approved|rejected&eventId= - submissions for the
// review queue, oldest first for pending (first in, first reviewed) and
// newest first otherwise.
export async function GET(request: NextRequest) {
  const { allowed } = await checkPermission("manage_bingo");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = bingoServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const status = ["pending", "approved", "rejected"].includes(request.nextUrl.searchParams.get("status") ?? "") ? request.nextUrl.searchParams.get("status")! : "pending";
  const eventId = request.nextUrl.searchParams.get("eventId");
  let query = supabase
    .from("bingo_submissions")
    .select(
      "id, event_id, tile_id, team_id, submitter_rsn, source, image_urls, quantity, note, status, reviewed_by, reviewed_at, review_note, created_at, bingo_events(name, status), bingo_tiles(title, description, points, kind, required_count, accepted_items, icon_kind, icon_ref, icon_item_id), bingo_teams(name, color)"
    )
    .eq("status", status)
    .order("created_at", { ascending: status === "pending" })
    .limit(200);
  if (eventId) query = query.eq("event_id", eventId);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Failed to load submissions." }, { status: 500 });

  // How far each (tile, team) already is, so the reviewer sees "1 of 2 so far".
  const tileIds = [...new Set((data ?? []).map((s) => s.tile_id))];
  const { data: progress } = tileIds.length
    ? await supabase.from("bingo_progress").select("tile_id, team_id, progress, completed_at").in("tile_id", tileIds)
    : { data: [] };
  return NextResponse.json({
    submissions: (data ?? []).map((s) => {
      const p = (progress ?? []).find((x) => x.tile_id === s.tile_id && x.team_id === s.team_id);
      return { ...s, teamProgress: Number(p?.progress ?? 0), teamCompleted: !!p?.completed_at };
    }),
  });
}
