import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/check-permission";
import { loadQuestBundle, logQuestActivity, questServiceClient, recordCompletion, removeCompletion } from "@/lib/quest-server";

// PATCH - review one quest screenshot.
//   { action: "approve" }        counts the quest for the player
//   { action: "reject", note }   sends it back with a reason they see
//   { action: "reopen" }         puts a reviewed one back in the queue (and
//                                takes the quest back off if it was approved)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ subId: string }> }) {
  const { subId } = await params;
  const { allowed, user } = await checkPermission("manage_quests");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = questServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: sub } = await supabase.from("quest_event_submissions").select("id, event_id, participant_id, quest_name, image_urls, status").eq("id", subId).maybeSingle();
  if (!sub) return NextResponse.json({ error: "Submission not found." }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const action = body.action;
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) || null : null;
  if (!["approve", "reject", "reopen"].includes(action)) return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  if (action === "reject" && !note) return NextResponse.json({ error: "Say why, so they know what to fix." }, { status: 400 });

  const update =
    action === "reopen"
      ? { status: "pending", reviewed_by: null, reviewed_at: null, review_note: null }
      : { status: action === "approve" ? "approved" : "rejected", reviewed_by: user?.discord_username ?? null, reviewed_at: new Date().toISOString(), review_note: note };
  const { error } = await supabase.from("quest_event_submissions").update(update).eq("id", subId);
  if (error) return NextResponse.json({ error: "Couldn't save the review." }, { status: 500 });

  if (action === "approve") {
    const bundle = await loadQuestBundle(supabase, sub.event_id);
    const participant = bundle?.participants.find((p) => p.id === sub.participant_id);
    if (bundle && participant) await recordCompletion(supabase, bundle, participant, sub.quest_name, "proof", sub.image_urls);
  } else if (action === "reject") {
    await logQuestActivity(supabase, { event_id: sub.event_id, participant_id: sub.participant_id, quest_name: sub.quest_name, kind: "rejected" });
  } else if (sub.status === "approved") {
    const { data: completion } = await supabase.from("quest_event_completions").select("source").eq("participant_id", sub.participant_id).eq("quest_name", sub.quest_name).maybeSingle();
    if (completion?.source === "proof") await removeCompletion(supabase, sub.event_id, sub.participant_id, sub.quest_name);
  }
  return NextResponse.json({ reviewed: true });
}
