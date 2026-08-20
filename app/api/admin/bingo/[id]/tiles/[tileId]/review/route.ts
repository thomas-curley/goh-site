import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { postToDestination } from "@/lib/discord";
import { getAlertChannel } from "@/lib/alert-channels";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// PATCH - approve or reject a manual tile submission for one team. Approving
// marks it completed and (if a channel is configured) posts to Discord;
// rejecting resets it to incomplete so the team can resubmit.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string; tileId: string }> }) {
  const { id, tileId } = await params;
  const { allowed, user } = await checkPermission("manage_bingo");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const teamId = typeof body.teamId === "string" ? body.teamId : "";
  const status = body.status;
  if (!teamId) return NextResponse.json({ error: "teamId is required." }, { status: 400 });
  if (status !== "completed" && status !== "incomplete") {
    return NextResponse.json({ error: "status must be 'completed' (approve) or 'incomplete' (reject)." }, { status: 400 });
  }

  const { data: tile } = await supabase.from("bingo_tiles").select("id, task_title, tracking_type").eq("id", tileId).eq("event_id", id).maybeSingle();
  if (!tile) return NextResponse.json({ error: "Tile not found." }, { status: 404 });
  if (tile.tracking_type !== "manual") return NextResponse.json({ error: "This tile is WOM-tracked, not manually reviewed." }, { status: 400 });

  const { data: completion } = await supabase.from("bingo_tile_completions").select("*").eq("tile_id", tileId).eq("team_id", teamId).maybeSingle();
  if (!completion) return NextResponse.json({ error: "Submission not found." }, { status: 404 });

  const reviewNotes = typeof body.reviewNotes === "string" ? body.reviewNotes.trim().slice(0, 1000) : null;

  const update: Record<string, unknown> = {
    status,
    review_notes: reviewNotes,
    reviewed_by: user?.discord_username ?? null,
    reviewed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  if (status === "completed") {
    try {
      const channelId = await getAlertChannel(supabase, "bingo_completions");
      if (channelId) {
        const { data: team } = await supabase.from("bingo_teams").select("name").eq("id", teamId).maybeSingle();
        const { data: event } = await supabase.from("bingo_events").select("name").eq("id", id).maybeSingle();
        const images: string[] = completion.image_urls ?? [];
        await postToDestination(
          channelId,
          `Tile completed: ${tile.task_title}`,
          `🎉 **${team?.name ?? "A team"}** completed **${tile.task_title}** in ${event?.name ?? "a bingo event"}!`,
          images.length > 0 ? images : undefined
        );
      }
    } catch (err) {
      console.error("Bingo completion Discord post failed:", err);
    }
  }

  const { error } = await supabase.from("bingo_tile_completions").update(update).eq("tile_id", tileId).eq("team_id", teamId);
  if (error) return NextResponse.json({ error: "Failed to update the submission." }, { status: 500 });

  return NextResponse.json({ updated: true });
}
