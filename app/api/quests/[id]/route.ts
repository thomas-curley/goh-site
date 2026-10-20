import { NextResponse, after } from "next/server";
import { eventOpen, getQuestViewer, loadQuestBundle, questServiceClient, syncQuestEvent, viewerParticipants } from "@/lib/quest-server";
import { computeStandings } from "@/lib/quests";

const STALE_MINUTES = 15;

// GET - one quest event for the member page: settings, teams, players,
// every counted quest, standings, the activity feed and the viewer's own
// place in it. Drafts are only visible to staff (as a preview).
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = questServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const [bundle, viewer] = await Promise.all([loadQuestBundle(supabase, id), getQuestViewer(supabase)]);
  if (!bundle || (bundle.event.status === "draft" && !viewer.isStaff)) {
    return NextResponse.json({ error: "Quest event not found." }, { status: 404 });
  }
  const { event, teams, participants, completions } = bundle;
  const mine = viewerParticipants(participants, viewer);

  const [{ data: activity }, { data: submissions }] = await Promise.all([
    supabase.from("quest_event_activity").select("id, participant_id, quest_name, kind, created_at").eq("event_id", id).order("created_at", { ascending: false }).limit(60),
    mine.length
      ? supabase
          .from("quest_event_submissions")
          .select("id, participant_id, quest_name, image_urls, note, status, review_note, created_at")
          .in("participant_id", mine.map((p) => p.id))
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  // Check WikiSync in the background when it's getting old.
  if (event.status === "active" || event.status === "signups") {
    const stale = !event.last_synced_at || Date.now() - Date.parse(event.last_synced_at) > STALE_MINUTES * 60_000;
    if (stale && participants.length) after(() => syncQuestEvent(supabase, id, { minAgeMinutes: STALE_MINUTES }).then(() => undefined).catch(() => undefined));
  }

  const now = Date.now();
  const ended = event.status === "completed" || (!!event.ends_at && Date.parse(event.ends_at) <= now);
  return NextResponse.json({
    event,
    teams,
    participants: participants.map(({ id, rsn, team_id, is_captain, has_wikisync, last_checked_at, joined_at }) => ({ id, rsn, team_id, is_captain, has_wikisync, last_checked_at, joined_at })),
    completions,
    standings: computeStandings(event, participants, teams, completions),
    activity: activity ?? [],
    submissions: submissions ?? [],
    viewer: {
      signedIn: !!viewer.userId,
      rsn: viewer.mainRsn,
      verified: viewer.verified,
      isStaff: viewer.isStaff,
      participantIds: mine.map((p) => p.id),
      canJoin: !!viewer.userId && mine.length === 0 && (event.status === "signups" || (event.status === "active" && !ended)),
      canLeave: mine.some((p) => p.user_id === viewer.userId) && (event.status === "signups" || (event.status === "active" && !!event.starts_at && Date.parse(event.starts_at) > now)),
      canSubmit: mine.length > 0 && eventOpen(event, now),
    },
  });
}
