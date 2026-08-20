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

// GET - public board detail: event, teams (with rosters), tiles, and every
// (tile, team) completion. Also resolves the current viewer's own team (by
// matching their verified RSN against team rosters) so the page knows which
// tiles it should offer a submit-screenshot control for.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: event } = await supabase
    .from("bingo_events")
    .select("id, name, description, banner_url, starts_at, ends_at, grid_size, status")
    .eq("id", id)
    .in("status", ["active", "completed"])
    .maybeSingle();
  if (!event) return NextResponse.json({ error: "Bingo event not found." }, { status: 404 });

  const { data: teams } = await supabase.from("bingo_teams").select("id, name, color").eq("event_id", id).order("created_at");
  const { data: members } = await supabase
    .from("bingo_team_members")
    .select("team_id, rsn")
    .in("team_id", (teams ?? []).map((t) => t.id));
  const { data: tiles } = await supabase
    .from("bingo_tiles")
    .select("id, position, task_title, task_description, tracking_type, wom_target_value")
    .eq("event_id", id)
    .order("position");
  const { data: completions } = await supabase
    .from("bingo_tile_completions")
    .select("tile_id, team_id, status, wom_progress_value, image_urls, submitted_at, review_notes")
    .in("tile_id", (tiles ?? []).map((t) => t.id));

  let viewerTeamId: string | null = null;
  try {
    const authClient = await createSupabaseServerClient();
    const { data: { user } } = await authClient.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("user_profiles").select("rsn, rsn_verified").eq("id", user.id).maybeSingle();
      if (profile?.rsn && profile.rsn_verified) {
        const match = (members ?? []).find((m) => normalizeRsn(m.rsn) === normalizeRsn(profile.rsn));
        viewerTeamId = match?.team_id ?? null;
      }
    }
  } catch {
    // Not logged in / Supabase auth unavailable -- no viewer team, read-only view.
  }

  return NextResponse.json({
    event,
    teams: (teams ?? []).map((t) => ({ ...t, members: (members ?? []).filter((m) => m.team_id === t.id).map((m) => m.rsn) })),
    tiles: tiles ?? [],
    completions: completions ?? [],
    viewerTeamId,
  });
}
