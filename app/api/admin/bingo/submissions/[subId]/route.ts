import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/check-permission";
import { bingoServiceClient, loadBingoBundle, logActivity, recomputeProofTile } from "@/lib/bingo-server";

// PATCH - review one submission.
//   { action: "approve", quantity? }  counts it (quantity can be corrected)
//   { action: "reject", note }        sends it back with a reason the team sees
//   { action: "reopen" }              puts a reviewed one back in the queue
// The team's progress on the tile is recalculated from its approved
// submissions each time, so approving, rejecting and reopening stay in step.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ subId: string }> }) {
  const { subId } = await params;
  const { allowed, user } = await checkPermission("manage_bingo");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = bingoServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: sub } = await supabase.from("bingo_submissions").select("id, event_id, tile_id, team_id, submitter_rsn, image_urls, quantity, status").eq("id", subId).maybeSingle();
  if (!sub) return NextResponse.json({ error: "Submission not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const action = body.action;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null;
  if (action === "reject" && !note) return NextResponse.json({ error: "Say why, so the team knows what to fix." }, { status: 400 });
  if (!["approve", "reject", "reopen"].includes(action)) return NextResponse.json({ error: "Unknown action." }, { status: 400 });

  const update: Record<string, unknown> =
    action === "reopen"
      ? { status: "pending", reviewed_by: null, reviewed_at: null, review_note: null }
      : { status: action === "approve" ? "approved" : "rejected", reviewed_by: user?.discord_username ?? null, reviewed_at: new Date().toISOString(), review_note: note };
  if (action === "approve" && body.quantity != null) update.quantity = Math.max(1, Math.min(1000, Math.floor(Number(body.quantity) || 1)));

  const { error } = await supabase.from("bingo_submissions").update(update).eq("id", subId);
  if (error) return NextResponse.json({ error: "Couldn't save the review." }, { status: 500 });

  const bundle = await loadBingoBundle(supabase, sub.event_id);
  const tile = bundle?.tiles.find((t) => t.id === sub.tile_id);
  if (bundle && tile) {
    if (action === "reject") {
      const team = bundle.teams.find((t) => t.id === sub.team_id);
      await logActivity(supabase, {
        event_id: sub.event_id,
        team_id: sub.team_id,
        tile_id: sub.tile_id,
        kind: "rejected",
        rsn: sub.submitter_rsn,
        message: `Staff sent back ${sub.submitter_rsn}'s proof for ${tile.title}${team ? ` (${team.name})` : ""}`,
      });
    }
    await recomputeProofTile(supabase, bundle, tile, sub.team_id, { byRsn: sub.submitter_rsn, images: action === "approve" ? sub.image_urls : undefined });
  }
  return NextResponse.json({ reviewed: true });
}
