import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { bingoServiceClient, createSubmission, findTeamFor, loadBingoBundle, storeRemoteImages, userRsns } from "@/lib/bingo-server";
import { syncEventAutoTiles } from "@/lib/bingo-sync";
import { computeStandings, progressText } from "@/lib/bingo";

// Bingo endpoints for the Discord bot (Bearer DISCORD_WEBHOOK_SECRET).
// Players are identified by their Discord id, matched to a site account.

function authorized(request: NextRequest) {
  const secret = process.env.DISCORD_WEBHOOK_SECRET;
  return !!secret && request.headers.get("authorization") === `Bearer ${secret}`;
}

async function playerFor(supabase: SupabaseClient, discordId: string) {
  const { data: profile } = await supabase.from("user_profiles").select("id").eq("discord_id", discordId).maybeSingle();
  if (!profile) return null;
  const rsns = await userRsns(supabase, profile.id);
  return { userId: profile.id as string, rsns: rsns.all };
}

/** The live boards this player is on, with their team's tiles. */
async function boardsFor(supabase: SupabaseClient, player: { rsns: string[] }) {
  const { data: events } = await supabase.from("bingo_events").select("id").eq("status", "active").order("starts_at", { ascending: false });
  const boards = [];
  for (const e of events ?? []) {
    const bundle = await loadBingoBundle(supabase, e.id);
    if (!bundle) continue;
    const mine = findTeamFor(bundle.teams, player.rsns);
    if (!mine) continue;
    boards.push({ bundle, mine });
  }
  return boards;
}

// GET ?discordId= - the player's live boards: tiles (for /bingo submit
// autocomplete) and standings (for /bingo board).
export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = bingoServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const discordId = request.nextUrl.searchParams.get("discordId") ?? "";
  const player = discordId ? await playerFor(supabase, discordId) : null;
  if (!player) return NextResponse.json({ linked: false, boards: [] });

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const boards = (await boardsFor(supabase, player)).map(({ bundle, mine }) => {
    const { event, teams, tiles, progress } = bundle;
    const standings = computeStandings(event, tiles, teams.map((t) => t.id), progress);
    return {
      eventId: event.id,
      name: event.name,
      endsAt: event.ends_at,
      url: `${site}/bingo/${event.id}`,
      teamId: mine.teamId,
      teamName: teams.find((t) => t.id === mine.teamId)?.name ?? "",
      standings: standings.map((s, i) => ({ rank: i + 1, name: teams.find((t) => t.id === s.teamId)?.name ?? "", total: s.total, tilesDone: s.tilesDone, lines: s.lines.length, mine: s.teamId === mine.teamId })),
      tiles: tiles.map((t) => {
        const p = progress.find((x) => x.tile_id === t.id && x.team_id === mine.teamId);
        return { id: t.id, position: t.position, title: t.title, kind: t.kind, points: t.points, done: !!p?.completed_at, progress: progressText(t, p?.progress ?? 0) };
      }),
    };
  });
  return NextResponse.json({ linked: true, boards });
}

// POST
//   { action: "submit", discordId, tileId, attachmentUrls, quantity?, note? }
//   { action: "sync" }  refresh every live board's tracked tiles (skips fresh ones)
export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supabase = bingoServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const body = await request.json().catch(() => ({}));

  if (body.action === "sync") {
    const { data: events } = await supabase.from("bingo_events").select("id").eq("status", "active");
    let synced = 0;
    for (const e of events ?? []) {
      const r = await syncEventAutoTiles(supabase, e.id, { minAgeMinutes: 20 });
      if (!r.skipped) synced++;
    }
    return NextResponse.json({ synced });
  }

  if (body.action !== "submit") return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  const player = typeof body.discordId === "string" ? await playerFor(supabase, body.discordId) : null;
  if (!player) return NextResponse.json({ error: "Link your Discord to the website first (sign in on the site), so I know which RSN you are." }, { status: 403 });

  const tileId = typeof body.tileId === "string" ? body.tileId : "";
  const { data: tileRow } = await supabase.from("bingo_tiles").select("event_id").eq("id", tileId).maybeSingle();
  if (!tileRow) return NextResponse.json({ error: "I couldn't find that tile. Pick one from the list." }, { status: 404 });
  const bundle = await loadBingoBundle(supabase, tileRow.event_id);
  const mine = bundle ? findTeamFor(bundle.teams, player.rsns) : null;
  if (!bundle || !mine) return NextResponse.json({ error: "You aren't on a team for that bingo." }, { status: 403 });

  const imageUrls = await storeRemoteImages(supabase, Array.isArray(body.attachmentUrls) ? body.attachmentUrls : []);
  if (imageUrls.length === 0) return NextResponse.json({ error: "Attach a screenshot (PNG or JPG, under 10 MB)." }, { status: 400 });

  const result = await createSubmission(supabase, bundle, {
    tileId,
    teamId: mine.teamId,
    rsn: mine.rsn,
    userId: player.userId,
    source: "discord",
    imageUrls,
    quantity: body.quantity,
    note: typeof body.note === "string" ? body.note : null,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  const tile = bundle.tiles.find((t) => t.id === tileId);
  return NextResponse.json({ submitted: true, tileTitle: tile?.title ?? "", eventName: bundle.event.name, teamName: bundle.teams.find((t) => t.id === mine.teamId)?.name ?? "" });
}
