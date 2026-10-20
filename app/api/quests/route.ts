import { NextResponse } from "next/server";
import { getQuestViewer, QUEST_EVENT_COLUMNS, questServiceClient, viewerParticipants } from "@/lib/quest-server";
import { computeStandings, eventQuests, type QuestCompletion, type QuestEvent, type QuestParticipant, type QuestTeam } from "@/lib/quests";

// GET - every quest event that isn't a draft, with the top of the
// leaderboard and whether the viewer is in it.
export async function GET() {
  const supabase = questServiceClient();
  if (!supabase) return NextResponse.json({ events: [] });

  const { data: events, error } = await supabase
    .from("quest_events")
    .select(QUEST_EVENT_COLUMNS)
    .in("status", ["signups", "active", "completed"])
    .order("starts_at", { ascending: false, nullsFirst: true });
  if (error) return NextResponse.json({ error: "Failed to load quest events." }, { status: 500 });
  const list = (events ?? []) as QuestEvent[];
  const ids = list.map((e) => e.id);
  if (ids.length === 0) return NextResponse.json({ events: [] });

  const viewer = await getQuestViewer(supabase);
  const [{ data: teams }, { data: participants }, { data: completions }] = await Promise.all([
    supabase.from("quest_event_teams").select("id, event_id, name, color, sort_order").in("event_id", ids).order("sort_order"),
    supabase.from("quest_event_participants").select("id, event_id, user_id, rsn, team_id, is_captain, has_wikisync, quests_done, baseline_at, last_checked_at, joined_at").in("event_id", ids),
    supabase.from("quest_event_completions").select("event_id, participant_id, quest_name, source, completed_at").in("event_id", ids),
  ]);

  return NextResponse.json({
    signedIn: !!viewer.userId,
    events: list.map((event) => {
      const p = (participants ?? []).filter((x) => x.event_id === event.id) as (QuestParticipant & { event_id: string })[];
      const t = (teams ?? []).filter((x) => x.event_id === event.id) as QuestTeam[];
      const c = (completions ?? []).filter((x) => x.event_id === event.id) as QuestCompletion[];
      const mine = viewerParticipants(p, viewer);
      const standings = event.status === "signups" ? [] : computeStandings(event, p, t, c);
      return {
        ...event,
        questCount: eventQuests(event).length,
        playerCount: p.length,
        viewerJoined: mine.length > 0,
        viewerRowId: event.format === "teams" ? mine[0]?.team_id ?? null : mine[0]?.id ?? null,
        standings: standings.slice(0, 5).map(({ id, name, color, points, quests }) => ({ id, name, color, points, quests })),
      };
    }),
  });
}
