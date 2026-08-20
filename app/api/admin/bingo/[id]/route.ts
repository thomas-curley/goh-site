import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { editWomCompetition } from "@/lib/wom";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET - full board detail for the admin edit page: event, teams+members, tiles.
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { allowed } = await checkPermission("manage_bingo");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: event } = await supabase.from("bingo_events").select("*").eq("id", id).maybeSingle();
  if (!event) return NextResponse.json({ error: "Bingo event not found." }, { status: 404 });

  const { data: teams } = await supabase.from("bingo_teams").select("*").eq("event_id", id).order("created_at");
  const { data: members } = await supabase
    .from("bingo_team_members")
    .select("*")
    .in("team_id", (teams ?? []).map((t) => t.id));
  const { data: tiles } = await supabase.from("bingo_tiles").select("*").eq("event_id", id).order("position");

  return NextResponse.json({
    event,
    teams: (teams ?? []).map((t) => ({ ...t, members: (members ?? []).filter((m) => m.team_id === t.id) })),
    tiles: tiles ?? [],
  });
}

// PATCH - update event metadata, tile task text, and team rosters. Doesn't
// support changing a tile's tracking type/WOM link, or the board's grid size
// -- those are a delete-and-recreate for V1 (see plan's "explicitly out of
// scope"). Roster edits wholesale-replace each WOM-tracked tile's competition
// teams via editWomCompetition so tracking stays in sync with who's actually
// on each team.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { allowed } = await checkPermission("manage_bingo");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: event } = await supabase.from("bingo_events").select("id, status").eq("id", id).maybeSingle();
  if (!event) return NextResponse.json({ error: "Bingo event not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));

  const eventUpdate: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof body.name === "string" && body.name.trim()) eventUpdate.name = body.name.trim().slice(0, 100);
  if (typeof body.description === "string") eventUpdate.description = body.description.trim().slice(0, 2000) || null;
  if (typeof body.bannerUrl === "string") eventUpdate.banner_url = body.bannerUrl.trim() || null;
  if (typeof body.startsAt === "string") eventUpdate.starts_at = body.startsAt || null;
  if (typeof body.endsAt === "string") eventUpdate.ends_at = body.endsAt || null;
  if (["draft", "active", "completed"].includes(body.status)) eventUpdate.status = body.status;

  const { error: eventError } = await supabase.from("bingo_events").update(eventUpdate).eq("id", id);
  if (eventError) return NextResponse.json({ error: "Failed to update the event." }, { status: 500 });

  // Tile task text edits, keyed by tile id.
  if (Array.isArray(body.tiles)) {
    for (const t of body.tiles) {
      if (typeof t !== "object" || !t || typeof t.id !== "string") continue;
      const tileUpdate: Record<string, unknown> = {};
      if (typeof t.taskTitle === "string" && t.taskTitle.trim()) tileUpdate.task_title = t.taskTitle.trim();
      if (typeof t.taskDescription === "string") tileUpdate.task_description = t.taskDescription.trim() || null;
      if (Number.isFinite(t.womTargetValue)) tileUpdate.wom_target_value = t.womTargetValue;
      if (Object.keys(tileUpdate).length > 0) {
        await supabase.from("bingo_tiles").update(tileUpdate).eq("id", t.id).eq("event_id", id);
      }
    }
  }

  // Team roster edits: replace each team's member list, then re-sync any
  // WOM-tracked tile's competition to the rebuilt team rosters.
  if (Array.isArray(body.teams)) {
    const incomingTeams: { id: string; name?: string; members: string[] }[] = body.teams
      .filter((t: unknown): t is Record<string, unknown> => typeof t === "object" && t !== null && typeof (t as Record<string, unknown>).id === "string")
      .map((t: Record<string, unknown>) => ({
        id: t.id as string,
        name: typeof t.name === "string" ? t.name.trim() : undefined,
        members: Array.isArray(t.members) ? t.members.map((m) => (typeof m === "string" ? m.trim() : "")).filter(Boolean) : [],
      }));

    for (const team of incomingTeams) {
      const teamUpdate: Record<string, unknown> = {};
      if (team.name) teamUpdate.name = team.name;
      if (Object.keys(teamUpdate).length > 0) await supabase.from("bingo_teams").update(teamUpdate).eq("id", team.id).eq("event_id", id);

      await supabase.from("bingo_team_members").delete().eq("team_id", team.id);
      if (team.members.length > 0) {
        await supabase.from("bingo_team_members").insert(team.members.map((rsn) => ({ team_id: team.id, rsn })));
      }
    }

    // Rebuild the full teams payload (name + roster) for WOM re-sync.
    const { data: allTeams } = await supabase.from("bingo_teams").select("id, name").eq("event_id", id);
    const { data: allMembers } = await supabase
      .from("bingo_team_members")
      .select("team_id, rsn")
      .in("team_id", (allTeams ?? []).map((t) => t.id));
    const teamsPayload = (allTeams ?? []).map((t) => ({
      name: t.name,
      participants: (allMembers ?? []).filter((m) => m.team_id === t.id).map((m) => m.rsn),
    }));

    const { data: womTiles } = await supabase
      .from("bingo_tiles")
      .select("wom_competition_id")
      .eq("event_id", id)
      .eq("tracking_type", "wom")
      .not("wom_competition_id", "is", null);

    const womCompetitionIds = [...new Set((womTiles ?? []).map((t) => t.wom_competition_id as string))];
    const syncErrors: string[] = [];
    for (const womCompId of womCompetitionIds) {
      const { data: comp } = await supabase.from("wom_competitions").select("wom_id, verification_code").eq("id", womCompId).maybeSingle();
      if (!comp) continue;
      try {
        await editWomCompetition(comp.wom_id, { teams: teamsPayload }, comp.verification_code);
      } catch (err) {
        syncErrors.push(err instanceof Error ? err.message : `Failed to sync competition ${comp.wom_id}.`);
      }
    }
    if (syncErrors.length > 0) {
      return NextResponse.json({ updated: true, warning: `Rosters saved, but some WOM competitions failed to sync: ${syncErrors.join("; ")}` });
    }
  }

  return NextResponse.json({ updated: true });
}

// DELETE - remove the board entirely (cascades to teams/members/tiles/completions).
// Does not delete linked WOM competitions -- those stay on WOM/wom_competitions,
// manage them from Admin > WOM Competitions if they should be removed too.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { allowed } = await checkPermission("manage_bingo");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { error } = await supabase.from("bingo_events").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to delete the event." }, { status: 500 });

  return NextResponse.json({ deleted: true });
}
