import { NextRequest, NextResponse, after } from "next/server";
import { getQuestViewer, loadQuestBundle, logQuestActivity, questServiceClient, syncParticipant, viewerParticipants } from "@/lib/quest-server";

async function context(id: string) {
  const supabase = questServiceClient();
  if (!supabase) return { error: NextResponse.json({ error: "Supabase not configured" }, { status: 503 }) };
  const viewer = await getQuestViewer(supabase);
  if (!viewer.userId) return { error: NextResponse.json({ error: "Sign in to join." }, { status: 401 }) };
  const bundle = await loadQuestBundle(supabase, id);
  if (!bundle || bundle.event.status === "draft") return { error: NextResponse.json({ error: "Quest event not found." }, { status: 404 }) };
  return { supabase, viewer, bundle };
}

// POST - join as the member's main RSN, during sign-ups or while it's live.
// Their starting snapshot is taken from WikiSync straight away.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await context(id);
  if ("error" in ctx) return ctx.error;
  const { supabase, viewer, bundle } = ctx;
  const { event } = bundle;
  const ended = event.status === "completed" || (!!event.ends_at && Date.parse(event.ends_at) <= Date.now());
  if (ended) return NextResponse.json({ error: "This quest event has ended." }, { status: 400 });
  if (!viewer.mainRsn || !viewer.verified) {
    return NextResponse.json({ error: "Link and verify your RSN on your Account page first, so we know whose quests to track." }, { status: 403 });
  }
  if (viewerParticipants(bundle.participants, viewer).length) return NextResponse.json({ joined: true });

  const { data: row, error } = await supabase
    .from("quest_event_participants")
    .insert({ event_id: id, user_id: viewer.userId, rsn: viewer.mainRsn })
    .select("id, user_id, rsn, team_id, is_captain, has_wikisync, quests_done, baseline_at, last_checked_at, joined_at")
    .single();
  if (error || !row) return NextResponse.json({ error: "Couldn't add you. Try again." }, { status: 500 });
  await logQuestActivity(supabase, { event_id: id, participant_id: row.id, kind: "joined" });
  bundle.participants.push(row);
  after(() => syncParticipant(supabase, bundle, row).then(() => undefined).catch(() => undefined));
  return NextResponse.json({ joined: true });
}

// DELETE - leave before the event starts.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await context(id);
  if ("error" in ctx) return ctx.error;
  const { event } = ctx.bundle;
  const started = event.status === "completed" || (event.status === "active" && (!event.starts_at || Date.parse(event.starts_at) <= Date.now()));
  if (started) return NextResponse.json({ error: "The event has started. Ask staff if you need to drop out." }, { status: 400 });
  await ctx.supabase.from("quest_event_participants").delete().eq("event_id", id).eq("user_id", ctx.viewer.userId);
  return NextResponse.json({ joined: false });
}
