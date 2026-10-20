import { NextResponse } from "next/server";
import { getQuestViewer, loadQuestBundle, questServiceClient, syncParticipant, viewerParticipants } from "@/lib/quest-server";

const MIN_GAP_MS = 60_000;

// POST - "Check my quests now": re-reads the viewer's own WikiSync.
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = questServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const viewer = await getQuestViewer(supabase);
  if (!viewer.userId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const bundle = await loadQuestBundle(supabase, id);
  if (!bundle || bundle.event.status === "draft") return NextResponse.json({ error: "Quest event not found." }, { status: 404 });
  if (bundle.event.status === "completed") return NextResponse.json({ error: "This quest event has finished." }, { status: 400 });
  const mine = viewerParticipants(bundle.participants, viewer);
  if (mine.length === 0) return NextResponse.json({ error: "You haven't joined this event." }, { status: 403 });

  const newQuests: string[] = [];
  let hasWikiSync = false;
  for (const p of mine) {
    if (p.last_checked_at && Date.now() - Date.parse(p.last_checked_at) < MIN_GAP_MS) {
      hasWikiSync ||= !!p.has_wikisync;
      continue;
    }
    const r = await syncParticipant(supabase, bundle, p);
    if (r.error) return NextResponse.json({ error: "WikiSync didn't answer. Try again in a minute." }, { status: 502 });
    newQuests.push(...r.newQuests);
    hasWikiSync ||= !!p.has_wikisync;
  }
  return NextResponse.json({ newQuests, hasWikiSync });
}
