import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/check-permission";
import { bingoServiceClient, EVENT_COLUMNS, TILE_COLUMNS } from "@/lib/bingo-server";
import { GRID_SIZES } from "@/lib/bingo";

// GET - every board for the admin list, newest first, with counts.
export async function GET() {
  const { allowed } = await checkPermission("manage_bingo");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = bingoServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: events, error } = await supabase.from("bingo_events").select(EVENT_COLUMNS).order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: "Failed to load bingo events." }, { status: 500 });
  const ids = (events ?? []).map((e) => e.id);
  const [{ data: tiles }, { data: members }, { data: pending }, { data: signups }] = ids.length
    ? await Promise.all([
        supabase.from("bingo_tiles").select("event_id").in("event_id", ids),
        supabase.from("bingo_team_members").select("event_id").in("event_id", ids),
        supabase.from("bingo_submissions").select("event_id").in("event_id", ids).eq("status", "pending"),
        supabase.from("bingo_signups").select("event_id").in("event_id", ids),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];
  const count = (rows: { event_id: string }[] | null, id: string) => (rows ?? []).filter((r) => r.event_id === id).length;

  return NextResponse.json({
    events: (events ?? []).map((e) => ({
      ...e,
      tileCount: count(tiles, e.id),
      playerCount: count(members, e.id),
      pendingCount: count(pending, e.id),
      signupCount: count(signups, e.id),
    })),
  });
}

// POST - start a new draft board, blank or copied from an earlier one
// (its tiles, settings and team names, but no players or progress).
export async function POST(request: NextRequest) {
  const { allowed, user } = await checkPermission("manage_bingo");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = bingoServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 100) : "";
  if (!name) return NextResponse.json({ error: "Give the bingo a name." }, { status: 400 });
  const copyFrom = typeof body.copyFrom === "string" && body.copyFrom ? body.copyFrom : null;

  let base: Record<string, unknown> = { grid_size: (GRID_SIZES as readonly number[]).includes(body.gridSize) ? body.gridSize : 5 };
  if (copyFrom) {
    const { data: source } = await supabase
      .from("bingo_events")
      .select("description, rules, banner_url, grid_size, win_rule, line_bonus, blackout_bonus, hide_other_teams")
      .eq("id", copyFrom)
      .maybeSingle();
    if (!source) return NextResponse.json({ error: "The board to copy wasn't found." }, { status: 404 });
    base = source;
  }

  const { data: event, error } = await supabase
    .from("bingo_events")
    .insert({ ...base, name, status: "draft", created_by: user?.discord_username ?? null })
    .select("id")
    .single();
  if (error || !event) return NextResponse.json({ error: "Couldn't create the bingo." }, { status: 500 });

  if (copyFrom) {
    const [{ data: tiles }, { data: teams }] = await Promise.all([
      supabase.from("bingo_tiles").select(TILE_COLUMNS).eq("event_id", copyFrom),
      supabase.from("bingo_teams").select("name, color, sort_order").eq("event_id", copyFrom),
    ]);
    if (tiles?.length) {
      await supabase.from("bingo_tiles").insert(tiles.map((t) => ({ ...t, id: undefined, event_id: event.id })));
    }
    if (teams?.length) await supabase.from("bingo_teams").insert(teams.map((t) => ({ ...t, event_id: event.id })));
  }

  return NextResponse.json({ id: event.id });
}
