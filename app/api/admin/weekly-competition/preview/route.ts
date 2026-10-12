import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { isDiscordSnowflake, parseDiscordMessageLink } from "@/lib/discord";
import { buildTurnoverPreview, type WeeklyConfig } from "@/lib/weekly-turnover";

// WOM standings + one larger OpenAI call (the guide/tips) can take a while.
export const maxDuration = 60;

const MAX_RAFFLE_WINNERS = 25;

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

// POST - build (but don't send) all three turnover posts for the admin to
// review and edit. Also remembers the thread / ping roles / raffle amount
// entered, so they're prefilled next time.
export async function POST(request: NextRequest) {
  const { allowed } = await checkPermission("manage_competitions");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data } = await supabase.from("weekly_competition_config").select("*").eq("id", 1).maybeSingle();
  if (!data) return NextResponse.json({ error: "weekly_competition_config row is missing." }, { status: 500 });
  const config = data as unknown as WeeklyConfig;

  if (!config.current_competition_type || config.current_competition_ids.length === 0) {
    return NextResponse.json({ error: "No current competition configured -- fix it under Manual recovery below." }, { status: 400 });
  }
  if (!config.next_competition_type || config.next_competition_ids.length === 0) {
    return NextResponse.json({ error: "Set up Next Week's competition first." }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
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
  const pingRoleIds: string[] = Array.isArray(body.pingRoleIds)
    ? body.pingRoleIds.filter((id: unknown): id is string => typeof id === "string" && (id === "@everyone" || id === "@here" || isDiscordSnowflake(id)))
    : [];

  await supabase
    .from("weekly_competition_config")
    .update({
      current_forum_thread_id: previousThreadId,
      ping_role_ids: pingRoleIds,
      raffle_prize_amount: raffleAmount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  try {
    const preview = await buildTurnoverPreview(supabase, config, { previousThreadId, raffleWinners, raffleAmount, pingRoleIds });
    return NextResponse.json({ preview });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to build the preview." }, { status: 400 });
  }
}
