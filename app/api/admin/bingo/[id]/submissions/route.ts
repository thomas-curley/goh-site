import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET - every manual tile's completion row for this event, across every
// team, joined with tile task text and team name -- everything the review
// queue needs in one call.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { allowed } = await checkPermission("manage_bingo");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: tiles } = await supabase.from("bingo_tiles").select("id, task_title, task_description").eq("event_id", id).eq("tracking_type", "manual");
  const { data: teams } = await supabase.from("bingo_teams").select("id, name").eq("event_id", id);
  const { data: completions } = await supabase
    .from("bingo_tile_completions")
    .select("*")
    .in("tile_id", (tiles ?? []).map((t) => t.id));

  const tileById = new Map((tiles ?? []).map((t) => [t.id, t]));
  const teamById = new Map((teams ?? []).map((t) => [t.id, t]));

  const submissions = (completions ?? [])
    .filter((c) => c.status !== "incomplete" || (c.image_urls?.length ?? 0) > 0)
    .map((c) => ({
      ...c,
      tile_title: tileById.get(c.tile_id)?.task_title ?? "Unknown tile",
      tile_description: tileById.get(c.tile_id)?.task_description ?? null,
      team_name: teamById.get(c.team_id)?.name ?? "Unknown team",
    }));

  return NextResponse.json({ submissions });
}
