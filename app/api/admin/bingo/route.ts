import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { createWomCompetition } from "@/lib/wom";
import { GRID_SIZES } from "@/lib/bingo";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

const MAX_NAME_LENGTH = 100;

interface IncomingTeam {
  name: string;
  color: string | null;
  members: string[]; // RSNs
}

interface IncomingTile {
  position: number;
  taskTitle: string;
  taskDescription: string | null;
  trackingType: "wom" | "manual";
  womSource?: "existing" | "auto-create"; // only when trackingType === "wom"
  womCompetitionWomId?: number; // "existing" -- a live WOM competition id to link
  womMetric?: string; // "auto-create"
  womTargetValue?: number | null;
}

// GET - list all bingo events (admin), most recent first.
export async function GET() {
  const { allowed } = await checkPermission("manage_bingo");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase.from("bingo_events").select("*").order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Failed to load bingo events." }, { status: 500 });

  return NextResponse.json({ events: data ?? [] });
}

// POST - create a board: the event row, its teams + members, and its tiles.
// For any tile with trackingType "wom" and womSource "auto-create", a WOM
// team competition is created for that tile's metric with every team's
// roster -- sequentially (not Promise.all, to stay within WOM's rate
// limits), returning a per-tile result list so a partial failure is
// recoverable instead of leaving the board half-configured with no
// visibility into what broke.
export async function POST(request: NextRequest) {
  const { allowed, user } = await checkPermission("manage_bingo");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));

  const name = typeof body.name === "string" ? body.name.trim().slice(0, MAX_NAME_LENGTH) : "";
  const description = typeof body.description === "string" ? body.description.trim().slice(0, 2000) || null : null;
  const bannerUrl = typeof body.bannerUrl === "string" ? body.bannerUrl.trim() || null : null;
  const startsAt = typeof body.startsAt === "string" && body.startsAt ? body.startsAt : null;
  const endsAt = typeof body.endsAt === "string" && body.endsAt ? body.endsAt : null;
  const gridSize = (GRID_SIZES as readonly number[]).includes(body.gridSize) ? body.gridSize : 5;

  const teams: IncomingTeam[] = Array.isArray(body.teams)
    ? body.teams
        .filter((t: unknown): t is Record<string, unknown> => typeof t === "object" && t !== null)
        .map((t: Record<string, unknown>) => ({
          name: typeof t.name === "string" ? t.name.trim() : "",
          color: typeof t.color === "string" ? t.color : null,
          members: Array.isArray(t.members) ? t.members.map((m) => (typeof m === "string" ? m.trim() : "")).filter(Boolean) : [],
        }))
        .filter((t: IncomingTeam) => t.name)
    : [];

  const tiles: IncomingTile[] = Array.isArray(body.tiles)
    ? body.tiles
        .filter((t: unknown): t is Record<string, unknown> => typeof t === "object" && t !== null)
        .map((t: Record<string, unknown>) => ({
          position: Number.isInteger(t.position) ? (t.position as number) : -1,
          taskTitle: typeof t.taskTitle === "string" ? t.taskTitle.trim() : "",
          taskDescription: typeof t.taskDescription === "string" ? t.taskDescription.trim() || null : null,
          trackingType: t.trackingType === "wom" ? "wom" : "manual",
          womSource: t.womSource === "existing" ? "existing" : "auto-create",
          womCompetitionWomId: Number.isFinite(t.womCompetitionWomId) ? Number(t.womCompetitionWomId) : undefined,
          womMetric: typeof t.womMetric === "string" ? t.womMetric : undefined,
          womTargetValue: Number.isFinite(t.womTargetValue) ? Number(t.womTargetValue) : null,
        }))
    : [];

  if (!name) return NextResponse.json({ error: "Name is required." }, { status: 400 });
  if (teams.length < 2) return NextResponse.json({ error: "Add at least two teams." }, { status: 400 });
  if (tiles.length !== gridSize * gridSize) {
    return NextResponse.json({ error: `Expected ${gridSize * gridSize} tiles for a ${gridSize}x${gridSize} board.` }, { status: 400 });
  }
  if (tiles.some((t) => !t.taskTitle)) return NextResponse.json({ error: "Every tile needs a task title." }, { status: 400 });
  for (const tile of tiles) {
    if (tile.trackingType !== "wom") continue;
    if (tile.womSource === "existing" && !tile.womCompetitionWomId) {
      return NextResponse.json({ error: `Tile "${tile.taskTitle}" is missing a WOM competition to link.` }, { status: 400 });
    }
    if (tile.womSource === "auto-create" && !tile.womMetric) {
      return NextResponse.json({ error: `Tile "${tile.taskTitle}" needs a metric to auto-create a competition for.` }, { status: 400 });
    }
  }

  // 1. Event
  const { data: event, error: eventError } = await supabase
    .from("bingo_events")
    .insert({
      name,
      description,
      banner_url: bannerUrl,
      starts_at: startsAt,
      ends_at: endsAt,
      grid_size: gridSize,
      status: "draft",
      created_by: user?.discord_username ?? null,
    })
    .select("id")
    .single();

  if (eventError || !event) return NextResponse.json({ error: "Failed to create the bingo event." }, { status: 500 });

  // 2. Teams + members
  const teamIdByName = new Map<string, string>();
  for (const team of teams) {
    const { data: teamRow, error: teamError } = await supabase
      .from("bingo_teams")
      .insert({ event_id: event.id, name: team.name, color: team.color })
      .select("id")
      .single();
    if (teamError || !teamRow) {
      return NextResponse.json({ error: `Failed to create team "${team.name}". The event was partially created (id: ${event.id}) -- delete it and retry.` }, { status: 500 });
    }
    teamIdByName.set(team.name, teamRow.id);

    if (team.members.length > 0) {
      await supabase.from("bingo_team_members").insert(team.members.map((rsn) => ({ team_id: teamRow.id, rsn })));
    }
  }

  // 3. Tiles, auto-creating WOM competitions sequentially where requested.
  const tileResults: { position: number; taskTitle: string; ok: boolean; error?: string }[] = [];
  const eventTitle = name;
  const womStartsAt = startsAt ?? new Date().toISOString();
  const womEndsAt = endsAt ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

  for (const tile of tiles) {
    let womCompetitionId: string | null = null;

    if (tile.trackingType === "wom") {
      try {
        if (tile.womSource === "existing" && tile.womCompetitionWomId) {
          const { data: existing } = await supabase
            .from("wom_competitions")
            .select("id")
            .eq("wom_id", tile.womCompetitionWomId)
            .maybeSingle();
          if (!existing) {
            tileResults.push({ position: tile.position, taskTitle: tile.taskTitle, ok: false, error: "That WOM competition isn't tracked on this site yet -- create it under Admin > WOM Competitions first, or choose Auto-create instead." });
            continue;
          }
          womCompetitionId = existing.id;
        } else if (tile.womSource === "auto-create" && tile.womMetric) {
          const created = await createWomCompetition({
            title: `${eventTitle} -- ${tile.taskTitle}`,
            metric: tile.womMetric,
            startsAt: womStartsAt,
            endsAt: womEndsAt,
            teams: teams.map((t) => ({ name: t.name, participants: t.members })),
          });

          const { data: womRow, error: womInsertError } = await supabase
            .from("wom_competitions")
            .insert({
              wom_id: created.competition.id,
              title: `${eventTitle} -- ${tile.taskTitle}`,
              metric: tile.womMetric,
              type: "team",
              starts_at: womStartsAt,
              ends_at: womEndsAt,
              group_linked: false,
              verification_code: created.verificationCode,
              teams: teams.map((t) => ({ name: t.name, participants: t.members })),
              created_by: user?.discord_username ?? null,
            })
            .select("id")
            .single();

          if (womInsertError || !womRow) {
            tileResults.push({ position: tile.position, taskTitle: tile.taskTitle, ok: false, error: `Competition was created on WOM (id ${created.competition.id}) but failed to save locally -- manage it directly on WOM and link it manually.` });
            continue;
          }
          womCompetitionId = womRow.id;
        }
      } catch (err) {
        tileResults.push({ position: tile.position, taskTitle: tile.taskTitle, ok: false, error: err instanceof Error ? err.message : "Failed to set up WOM tracking for this tile." });
        continue;
      }
    }

    const { data: tileRow, error: tileError } = await supabase
      .from("bingo_tiles")
      .insert({
        event_id: event.id,
        position: tile.position,
        task_title: tile.taskTitle,
        task_description: tile.taskDescription,
        tracking_type: tile.trackingType,
        wom_competition_id: womCompetitionId,
        wom_target_value: tile.womTargetValue,
      })
      .select("id")
      .single();

    if (tileError || !tileRow) {
      tileResults.push({ position: tile.position, taskTitle: tile.taskTitle, ok: false, error: "Failed to save this tile." });
      continue;
    }

    // 4. One completion row per (tile, team), so board reads never have to
    // handle a "no row yet" case.
    await supabase.from("bingo_tile_completions").insert(
      [...teamIdByName.values()].map((teamId) => ({ tile_id: tileRow.id, team_id: teamId }))
    );

    tileResults.push({ position: tile.position, taskTitle: tile.taskTitle, ok: true });
  }

  return NextResponse.json({ eventId: event.id, tileResults });
}
