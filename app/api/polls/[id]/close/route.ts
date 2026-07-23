import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { endPoll } from "@/lib/discord";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// POST - end a poll early. Irreversible on Discord's side.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { allowed } = await checkPermission("manage_polls");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: poll } = await supabase.from("polls").select("channel_id, discord_message_id").eq("id", id).maybeSingle();
  if (!poll) return NextResponse.json({ error: "Poll not found." }, { status: 404 });

  try {
    await endPoll(poll.channel_id, poll.discord_message_id);
  } catch (err) {
    console.error("Failed to close poll:", err);
    return NextResponse.json({ error: "Failed to close the poll in Discord." }, { status: 502 });
  }

  return NextResponse.json({ closed: true });
}
