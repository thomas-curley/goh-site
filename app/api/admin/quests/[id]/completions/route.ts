import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/check-permission";
import { loadQuestBundle, questServiceClient, recordCompletion, removeCompletion } from "@/lib/quest-server";
import { QUEST_BY_NAME } from "@/lib/quests";

async function context(id: string, request: NextRequest) {
  const { allowed } = await checkPermission("manage_quests");
  if (!allowed) return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  const supabase = questServiceClient();
  if (!supabase) return { error: NextResponse.json({ error: "Supabase not configured" }, { status: 503 }) };
  const bundle = await loadQuestBundle(supabase, id);
  if (!bundle) return { error: NextResponse.json({ error: "Quest event not found." }, { status: 404 }) };
  const body = await request.json().catch(() => ({}));
  const participant = bundle.participants.find((p) => p.id === body.participantId);
  if (!participant) return { error: NextResponse.json({ error: "Player not found." }, { status: 404 }) };
  const questName = typeof body.questName === "string" ? body.questName : "";
  if (!QUEST_BY_NAME.has(questName)) return { error: NextResponse.json({ error: "Unknown quest." }, { status: 400 }) };
  return { supabase, bundle, participant, questName };
}

// POST { participantId, questName } - staff count a quest for a player by hand.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await context(id, request);
  if ("error" in ctx) return ctx.error;
  const added = await recordCompletion(ctx.supabase, ctx.bundle, ctx.participant, ctx.questName, "staff");
  return NextResponse.json({ added });
}

// DELETE { participantId, questName } - take a quest back off a player. It
// stays off: WikiSync won't count it for them again in this event.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await context(id, request);
  if ("error" in ctx) return ctx.error;
  await removeCompletion(ctx.supabase, id, ctx.participant.id, ctx.questName, { keepOff: true });
  return NextResponse.json({ removed: true });
}
