import { NextRequest, NextResponse } from "next/server";
import { createQuestSubmission, getQuestViewer, loadQuestBundle, questServiceClient, viewerParticipants } from "@/lib/quest-server";
import { storagePublicPrefix } from "@/lib/bingo-server";

// POST { questName, imageUrls, note } - a screenshot for a quest WikiSync
// didn't pick up. The player is worked out from the viewer's own RSNs.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = questServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const viewer = await getQuestViewer(supabase);
  if (!viewer.userId) return NextResponse.json({ error: "Sign in to send a screenshot." }, { status: 401 });
  const bundle = await loadQuestBundle(supabase, id);
  if (!bundle || bundle.event.status === "draft") return NextResponse.json({ error: "Quest event not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const mine = viewerParticipants(bundle.participants, viewer);
  const participant = mine.find((p) => p.id === body.participantId) ?? mine[0];
  if (!participant) return NextResponse.json({ error: "You haven't joined this event." }, { status: 403 });

  const result = await createQuestSubmission(supabase, bundle, {
    participant,
    questName: typeof body.questName === "string" ? body.questName : "",
    source: "web",
    imageUrls: Array.isArray(body.imageUrls) ? body.imageUrls : [],
    note: typeof body.note === "string" ? body.note : null,
    publicPrefix: storagePublicPrefix(),
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ submitted: true, id: result.id });
}
