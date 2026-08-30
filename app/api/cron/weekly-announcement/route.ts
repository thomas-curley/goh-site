import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getCompetitionLeaders, getGroupCompetitions } from "@/lib/wom";
import { getAlertChannel } from "@/lib/alert-channels";
import { postToDestination } from "@/lib/discord";
import { generateWeeklyAnnouncementText } from "@/lib/weekly-announcement-text";
import {
  buildResultsMessage,
  buildNewWeekMessage,
  buildForumPost,
  toEdtCalendarDate,
  type WeeklyCompetitionType,
  type WeeklyLeader,
} from "@/lib/weekly-announcement-templates";

// Several sequential WOM/OpenAI/Discord calls plus two 5s waits can exceed
// the platform default -- give this route more room, same reasoning as
// snapshots/capture.
export const maxDuration = 60;

const RESULTS_LIMIT = 10;
// "Everyone" for dual-competition combining -- large enough that a real
// clan roster never gets truncated before summing.
const FULL_LEADERBOARD_LIMIT = 500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Combines two (or returns one) competition leaderboards into one ranked list, summing gains per player across ids for dual-BotW. */
async function computeCombinedLeaders(womIds: number[]): Promise<WeeklyLeader[]> {
  if (womIds.length <= 1) {
    if (womIds.length === 0) return [];
    return getCompetitionLeaders(womIds[0], RESULTS_LIMIT);
  }

  const totals = new Map<string, number>();
  for (const womId of womIds) {
    const full = await getCompetitionLeaders(womId, FULL_LEADERBOARD_LIMIT);
    for (const p of full) {
      totals.set(p.displayName, (totals.get(p.displayName) ?? 0) + p.gained);
    }
  }

  return [...totals.entries()]
    .map(([displayName, gained]) => ({ displayName, gained }))
    .sort((a, b) => b.gained - a.gained)
    .slice(0, RESULTS_LIMIT);
}

/** Resolves each competition id's own WOM title, for the dual-link display -- falls back to a generic label per id if the group competitions list can't be fetched or a match isn't found. */
async function resolveCompetitionNames(womIds: number[], fallbackName: string): Promise<string[]> {
  if (womIds.length <= 1) return [fallbackName];
  const all = await getGroupCompetitions();
  return womIds.map((id, i) => all.find((c) => c.id === id)?.title ?? `${fallbackName} (Part ${i + 1})`);
}

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

interface WeeklyConfig {
  current_competition_ids: number[];
  current_competition_type: WeeklyCompetitionType | null;
  current_competition_name: string | null;
  current_week_start_date: string | null;
  next_competition_ids: number[];
  next_competition_type: WeeklyCompetitionType | null;
  next_competition_name: string | null;
  last_run_at: string | null;
}

async function runWeeklyAnnouncement() {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data } = await supabase.from("weekly_competition_config").select("*").eq("id", 1).maybeSingle();
  if (!data) return NextResponse.json({ error: "weekly_competition_config row is missing." }, { status: 500 });
  const config = data as unknown as WeeklyConfig;

  // Idempotency guard: refuse to run twice in the same UTC calendar day, so
  // an accidental double-trigger (Vercel Cron plus a manual "Run Now", or
  // two manual clicks) can't double-post or double-rotate.
  if (config.last_run_at) {
    const today = new Date().toISOString().slice(0, 10);
    const lastRunDay = config.last_run_at.slice(0, 10);
    if (today === lastRunDay) {
      return NextResponse.json({ skipped: true, reason: "already ran today" });
    }
  }

  if (!config.current_competition_type || config.current_competition_ids.length === 0) {
    return NextResponse.json({ error: "No current competition configured -- set it under Admin > Weekly SOTW/BotW." }, { status: 400 });
  }
  if (!config.next_competition_type || config.next_competition_ids.length === 0) {
    return NextResponse.json({ error: "No next competition configured -- set it under Admin > Weekly SOTW/BotW before this runs." }, { status: 400 });
  }

  // weekStartDate comes from a stored calendar date (no time-of-day), so it
  // needs no EDT shift; startDate is "right now" at cron-execution time --
  // right at the UTC-midnight-Monday/8PM-EDT-Sunday boundary this cron is
  // scheduled for, so it does need shifting back to read as the correct
  // (Sunday) EDT calendar day.
  const weekStartDate = config.current_week_start_date ? new Date(config.current_week_start_date) : toEdtCalendarDate(new Date());
  const startDate = toEdtCalendarDate(new Date());

  const [leaders, text, nextCompetitionNames] = await Promise.all([
    computeCombinedLeaders(config.current_competition_ids),
    generateWeeklyAnnouncementText({
      finishedType: config.current_competition_type,
      finishedName: config.current_competition_name ?? "this week's competition",
      nextType: config.next_competition_type,
      nextName: config.next_competition_name ?? "next week's competition",
    }),
    resolveCompetitionNames(config.next_competition_ids, config.next_competition_name ?? "Competition"),
  ]);

  const resultsMessage = buildResultsMessage({
    type: config.current_competition_type,
    competitionName: config.current_competition_name ?? "Competition",
    weekStartDate,
    leaders,
    flavourLine: text.resultsFlavourLine,
    nextCompetitionName: config.next_competition_name,
  });

  const announcementsChannel = await getAlertChannel(supabase, "weekly_competition_announcements");
  if (!announcementsChannel) {
    return NextResponse.json({ error: "No Weekly SOTW/BotW Announcements channel configured. Set one under Admin > Alert Channels." }, { status: 400 });
  }
  const forumChannel = await getAlertChannel(supabase, "skill_or_kill_forum");
  if (!forumChannel) {
    return NextResponse.json({ error: "No Skill or Kill of the Week Forum channel configured. Set one under Admin > Alert Channels." }, { status: 400 });
  }

  try {
    await postToDestination(announcementsChannel, `${config.current_competition_name} Results`, resultsMessage);
  } catch (err) {
    console.error("Weekly announcement: results post failed:", err);
    return NextResponse.json({ error: "Failed to post results message. Nothing was rotated -- safe to retry." }, { status: 502 });
  }

  await sleep(5000);

  const newWeekMessage = buildNewWeekMessage({
    type: config.next_competition_type,
    competitionName: config.next_competition_name ?? "Competition",
    startDate,
    competitionIds: config.next_competition_ids,
    competitionNames: nextCompetitionNames,
    intro: text.newWeekIntro,
  });

  try {
    await postToDestination(announcementsChannel, `${config.next_competition_name} Announcement`, newWeekMessage);
  } catch (err) {
    console.error("Weekly announcement: new-week post failed:", err);
    return NextResponse.json({ error: "Results posted, but the new-week announcement failed. Nothing was rotated -- fix the issue and retry (results will re-post)." }, { status: 502 });
  }

  await sleep(5000);

  const forumPost = buildForumPost({
    type: config.next_competition_type,
    competitionName: config.next_competition_name ?? "Competition",
    startDate,
    competitionIds: config.next_competition_ids,
    competitionNames: nextCompetitionNames,
    intro: text.forumIntro,
  });

  try {
    await postToDestination(forumChannel, forumPost.title, forumPost.content);
  } catch (err) {
    console.error("Weekly announcement: forum post failed:", err);
    return NextResponse.json({ error: "Results + new-week announcement posted, but the forum post failed. Nothing was rotated -- fix the issue and retry (the first two will re-post)." }, { status: 502 });
  }

  // Only rotate once every post has actually succeeded.
  const { error: rotateError } = await supabase
    .from("weekly_competition_config")
    .update({
      current_competition_ids: config.next_competition_ids,
      current_competition_type: config.next_competition_type,
      current_competition_name: config.next_competition_name,
      current_week_start_date: startDate.toISOString().slice(0, 10),
      next_competition_ids: [],
      next_competition_type: null,
      next_competition_name: null,
      last_run_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  if (rotateError) {
    console.error("Weekly announcement: DB rotation failed after all posts succeeded:", rotateError);
    return NextResponse.json({ error: "All three posts went out, but rotating the config failed -- fix next_* manually under Admin > Weekly SOTW/BotW before next run." }, { status: 500 });
  }

  return NextResponse.json({
    posted: true,
    announcementsChannel,
    forumChannel,
    leaderCount: leaders.length,
    rotatedTo: config.next_competition_name,
  });
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = request.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  return runWeeklyAnnouncement();
}

export async function POST() {
  return runWeeklyAnnouncement();
}
