import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { normalizeRsn } from "@/lib/wom";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const MAX_IMAGES = 3;

// POST - a team member submits proof for a manual tile. The submitter's team
// is always resolved server-side from their own verified RSN -- never
// trusted from the request body -- so nobody can submit (or see) on behalf
// of a team they aren't on.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string; tileId: string }> }) {
  const { id, tileId } = await params;
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const authClient = await createSupabaseServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "You need to be signed in to submit a tile." }, { status: 401 });

  const { data: profile } = await supabase.from("user_profiles").select("rsn, rsn_verified").eq("id", user.id).maybeSingle();
  if (!profile?.rsn || !profile.rsn_verified) {
    return NextResponse.json({ error: "Link and verify your RSN on the Account page first." }, { status: 403 });
  }

  const { data: tile } = await supabase.from("bingo_tiles").select("id, tracking_type").eq("id", tileId).eq("event_id", id).maybeSingle();
  if (!tile) return NextResponse.json({ error: "Tile not found." }, { status: 404 });
  if (tile.tracking_type !== "manual") return NextResponse.json({ error: "This tile is tracked automatically and doesn't take submissions." }, { status: 400 });

  const { data: teams } = await supabase.from("bingo_teams").select("id").eq("event_id", id);
  const { data: members } = await supabase
    .from("bingo_team_members")
    .select("team_id, rsn")
    .in("team_id", (teams ?? []).map((t) => t.id));
  const match = (members ?? []).find((m) => normalizeRsn(m.rsn) === normalizeRsn(profile.rsn as string));
  if (!match) return NextResponse.json({ error: "You aren't on a team for this bingo event." }, { status: 403 });

  const { data: completion } = await supabase.from("bingo_tile_completions").select("status").eq("tile_id", tileId).eq("team_id", match.team_id).maybeSingle();
  if (completion?.status === "completed") return NextResponse.json({ error: "This tile is already completed." }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const imageUrls: string[] = Array.isArray(body.imageUrls)
    ? body.imageUrls.filter((u: unknown): u is string => typeof u === "string" && u.startsWith("http")).slice(0, MAX_IMAGES)
    : [];
  if (imageUrls.length === 0) return NextResponse.json({ error: "Add at least one screenshot." }, { status: 400 });

  const { error } = await supabase
    .from("bingo_tile_completions")
    .update({
      status: "pending_review",
      image_urls: imageUrls,
      submitted_by: user.id,
      submitted_at: new Date().toISOString(),
      reviewed_by: null,
      reviewed_at: null,
      review_notes: null,
      updated_at: new Date().toISOString(),
    })
    .eq("tile_id", tileId)
    .eq("team_id", match.team_id);

  if (error) return NextResponse.json({ error: "Failed to submit." }, { status: 500 });

  return NextResponse.json({ submitted: true });
}
