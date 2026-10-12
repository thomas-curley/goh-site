import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { isDiscordSnowflake, parseDiscordMessageLink } from "@/lib/discord";
import { buildTurnoverPreview, type WeeklyConfig } from "@/lib/weekly-turnover";

// WOM standings + one larger OpenAI call (the guide/tips) can take a while.
export const maxDuration = 60;

const MAX_RAFFLE_WINNERS = 25;
// Discord's poll limits.
const MAX_POLL_OPTIONS = 10;
const MAX_POLL_OPTION_LENGTH = 55;

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** A pasted thread link or raw id -> the thread id, else null. */
function resolveThreadId(input: unknown): string | null {
  if (typeof input !== "string" || !input.trim()) return null;
  const { channelId } = parseDiscordMessageLink(input);
  if (channelId) return channelId;
  return isDiscordSnowflake(input) ? input.trim() : null;
}

// POST - build (but don't send) all the turnover posts for the admin to
// review and edit. Also remembers the threads / ping roles / raffle amount
// entered, so they're prefilled next time.
export async function POST(request: NextRequest) {
  const { allowed } = await checkPermission("manage_competitions");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data } = await supabase.from("weekly_competition_config").select("*").eq("id", 1).maybeSingle();
  if (!data) return NextResponse.json({ error: "weekly_competition_config row is missing." }, { status: 500 });
  const config = data as unknown as WeeklyConfig;

  const body = await request.json().catch(() => ({}));
  const ids = (value: unknown): number[] =>
    Array.isArray(value) ? [...new Set(value.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, 4) : [];
  const finishedIds = ids(body.finishedIds);
  const nextIds = ids(body.nextIds);
  const rawThread = typeof body.previousThread === "string" ? body.previousThread : "";
  const previousThreadId = resolveThreadId(rawThread);
  if (rawThread.trim() && !previousThreadId) {
    return NextResponse.json({ error: "Couldn't read that forum thread -- paste the thread's link or id." }, { status: 400 });
  }
  const raffleWinners: string[] = Array.isArray(body.raffleWinners)
    ? body.raffleWinners
        .filter((w: unknown): w is string => typeof w === "string")
        .map((w: string) => w.trim().slice(0, 50))
        .filter(Boolean)
        .slice(0, MAX_RAFFLE_WINNERS)
    : [];
  const raffleAmount = Number(body.raffleAmount);
  if (!Number.isFinite(raffleAmount) || raffleAmount < 0) {
    return NextResponse.json({ error: "Raffle prize must be a non-negative number." }, { status: 400 });
  }
  const rawVotingThread = typeof body.votingThread === "string" ? body.votingThread : "";
  const votingThreadId = resolveThreadId(rawVotingThread);
  if (rawVotingThread.trim() && !votingThreadId) {
    return NextResponse.json({ error: "Couldn't read the voting thread -- paste the thread's link or id." }, { status: 400 });
  }
  const pollOptions: string[] = Array.isArray(body.pollOptions)
    ? [...new Set<string>(body.pollOptions.filter((o: unknown): o is string => typeof o === "string").map((o: string) => o.trim().slice(0, MAX_POLL_OPTION_LENGTH)).filter(Boolean))].slice(0, MAX_POLL_OPTIONS)
    : [];
  const pollType = body.pollType === "sotw" || body.pollType === "botw" ? body.pollType : null;
  const pollWeek = typeof body.pollWeek === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.pollWeek) ? body.pollWeek : null;
  if (votingThreadId && pollOptions.length && (!pollType || !pollWeek)) {
    return NextResponse.json({ error: "Pick the voting poll's week and whether it's Skill or Boss of the Week." }, { status: 400 });
  }
  const pingRoleIds: string[] = Array.isArray(body.pingRoleIds)
    ? body.pingRoleIds.filter((id: unknown): id is string => typeof id === "string" && (id === "@everyone" || id === "@here" || isDiscordSnowflake(id)))
    : [];

  await supabase
    .from("weekly_competition_config")
    .update({
      current_forum_thread_id: previousThreadId,
      ping_role_ids: pingRoleIds,
      raffle_prize_amount: raffleAmount,
      voting_thread_id: votingThreadId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  try {
    const preview = await buildTurnoverPreview(supabase, config, { finishedIds, nextIds, previousThreadId, raffleWinners, raffleAmount, pingRoleIds, votingThreadId, pollOptions, pollType: pollType ?? "sotw", pollWeek: pollWeek ?? "" });
    return NextResponse.json({ preview });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to build the preview." }, { status: 400 });
  }
}
