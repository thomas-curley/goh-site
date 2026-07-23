import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { getPollMessage } from "@/lib/discord";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

interface StoredOption {
  answer_id: number;
  text: string;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const { allowed } = await checkPermission("manage_polls");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data: poll } = await supabase.from("polls").select("*").eq("id", id).maybeSingle();
  if (!poll) return NextResponse.json({ error: "Poll not found." }, { status: 404 });

  const guildId = process.env.DISCORD_GUILD_ID;
  const discordMessageUrl = guildId
    ? `https://discord.com/channels/${guildId}/${poll.channel_id}/${poll.discord_message_id}`
    : null;

  const options: StoredOption[] = poll.options ?? [];

  try {
    const message = await getPollMessage(poll.channel_id, poll.discord_message_id);
    const answerCounts: { id: number; count: number }[] = message.poll?.results?.answer_counts ?? [];
    const countByAnswerId = new Map(answerCounts.map((a) => [a.id, a.count]));

    const results = options.map((o) => ({
      text: o.text,
      count: countByAnswerId.get(o.answer_id) ?? 0,
    }));
    const totalVotes = results.reduce((sum, r) => sum + r.count, 0);

    return NextResponse.json({
      question: poll.question,
      options: results,
      totalVotes,
      isFinalized: message.poll?.results?.is_finalized ?? false,
      allowMultiselect: poll.allow_multiselect,
      available: true,
      discordMessageUrl,
    });
  } catch (err) {
    console.error("Failed to fetch poll results from Discord:", err);
    return NextResponse.json({
      question: poll.question,
      options: options.map((o) => ({ text: o.text, count: 0 })),
      totalVotes: 0,
      isFinalized: false,
      allowMultiselect: poll.allow_multiselect,
      available: false,
      discordMessageUrl,
    });
  }
}
