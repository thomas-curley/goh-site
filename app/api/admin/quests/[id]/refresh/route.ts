import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/check-permission";
import { questServiceClient, syncQuestEvent } from "@/lib/quest-server";

// POST - check every player's WikiSync now.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { allowed } = await checkPermission("manage_quests");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = questServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const result = await syncQuestEvent(supabase, id);
  if (result.skipped) return NextResponse.json({ error: "Only events with sign-ups open or live are checked." }, { status: 400 });
  return NextResponse.json(result);
}
