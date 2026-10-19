import { NextResponse } from "next/server";
import { bingoServiceClient, EVENT_COLUMNS, findTeamFor, getBingoViewer } from "@/lib/bingo-server";
import { computeStandings, type BingoEvent, type BingoTeam } from "@/lib/bingo";

// GET - the bingo home page: every board that isn't a draft, with team
// standings for live and finished ones, and where the viewer fits in
// (signed up, on a team).
export async function GET() {
  const supabase = bingoServiceClient();
  if (!supabase) return NextResponse.json({ events: [] });

  const { data: events, error } = await supabase
    .from("bingo_events")
    .select(EVENT_COLUMNS)
    .in("status", ["signups", "active", "completed"])
    .order("starts_at", { ascending: false, nullsFirst: true });
  if (error) return NextResponse.json({ error: "Failed to load bingo events." }, { status: 500 });
  const list = (events ?? []) as BingoEvent[];
  const ids = list.map((e) => e.id);
  if (ids.length === 0) return NextResponse.json({ events: [] });

  const viewer = await getBingoViewer(supabase);
  const [{ data: teams }, { data: members }, { data: tiles }, { data: progress }, { data: signups }] = await Promise.all([
    supabase.from("bingo_teams").select("id, event_id, name, color, sort_order").in("event_id", ids).order("sort_order"),
    supabase.from("bingo_team_members").select("team_id, event_id, rsn, is_captain").in("event_id", ids),
    supabase.from("bingo_tiles").select("id, event_id, position, points").in("event_id", ids),
    supabase.from("bingo_progress").select("tile_id, team_id, event_id, completed_at").in("event_id", ids).not("completed_at", "is", null),
    supabase.from("bingo_signups").select("event_id, user_id").in("event_id", ids),
  ]);

  return NextResponse.json({
    signedIn: !!viewer.userId,
    events: list.map((event) => {
      const eventTeams: BingoTeam[] = (teams ?? [])
        .filter((t) => t.event_id === event.id)
        .map((t) => ({ ...t, members: (members ?? []).filter((m) => m.team_id === t.id).map((m) => ({ rsn: m.rsn, is_captain: m.is_captain })) }));
      const eventTiles = (tiles ?? []).filter((t) => t.event_id === event.id);
      const standings =
        event.status === "signups"
          ? []
          : computeStandings(event, eventTiles, eventTeams.map((t) => t.id), (progress ?? []).filter((p) => p.event_id === event.id));
      const mine = findTeamFor(eventTeams, viewer.rsns);
      const eventSignups = (signups ?? []).filter((s) => s.event_id === event.id);
      return {
        ...event,
        tileCount: eventTiles.length,
        playerCount: eventTeams.reduce((n, t) => n + t.members.length, 0),
        signupCount: eventSignups.length,
        viewerSignedUp: !!viewer.userId && eventSignups.some((s) => s.user_id === viewer.userId),
        viewerTeamId: mine?.teamId ?? null,
        standings: standings.map((s) => {
          const team = eventTeams.find((t) => t.id === s.teamId);
          return { teamId: s.teamId, name: team?.name ?? "", color: team?.color ?? null, total: s.total, tilesDone: s.tilesDone };
        }),
      };
    }),
  });
}
