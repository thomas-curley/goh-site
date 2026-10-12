import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyMetric, getCompetitionLeaders, getGroupCompetitions } from "@/lib/wom";
import { getAlertChannel } from "@/lib/alert-channels";
import { formatRolePingMentions } from "@/lib/post-templates";
import { generateWeeklyAnnouncementText } from "@/lib/weekly-announcement-text";
import {
  bareCompetitionName,
  buildForumGuideSection,
  buildForumPost,
  buildForumTipsSection,
  buildRaffleMessage,
  buildPollQuestion,
  buildResultsMessage,
  oppositeType,
  type PrizeStructure,
  type WeeklyCompetitionType,
  type WeeklyLeader,
} from "@/lib/weekly-announcement-templates";

/** Paid placements per week -- matches the payouts default of top 10 (migration 045). */
const WINNER_COUNT = 10;
// "Everyone" for dual-competition combining -- large enough that a real clan
// roster never gets truncated before summing.
const FULL_LEADERBOARD_LIMIT = 500;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
// Closes before the next Sunday turnover, so the winner is known in time to
// set up its WOM competition.
const POLL_DURATION_HOURS = 6 * 24;

/**
 * The parts of weekly_competition_config the turnover still uses. The
 * current_* columns are written on every turnover so next week's form can
 * preselect what was posted; next_* columns are no longer used (competitions
 * are picked on the turnover form itself).
 */
export interface WeeklyConfig {
  current_competition_ids: number[];
  current_forum_thread_id: string | null;
  current_competition_emoji: string | null;
  ping_role_ids: string[] | null;
  raffle_prize_amount: number | string | null;
  voting_thread_id: string | null;
  last_run_at: string | null;
}

/** A WOM group competition as offered in the turnover form's pickers. */
export interface PickableCompetition {
  id: number;
  title: string;
  metric: string;
  startsAt: string;
  endsAt: string;
}

/** Group competitions from the last few weeks / next few weeks -- the only ones worth offering in the pickers. */
export async function getPickableCompetitions(): Promise<PickableCompetition[]> {
  const now = Date.now();
  const window = 5 * WEEK_MS;
  const all = await getGroupCompetitions();
  return all
    .filter((c) => new Date(c.endsAt).getTime() >= now - window && new Date(c.startsAt).getTime() <= now + window)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
    .map((c) => ({ id: c.id, title: c.title, metric: c.metric, startsAt: new Date(c.startsAt).toISOString(), endsAt: new Date(c.endsAt).toISOString() }));
}

function competitionType(metric: string, title: string): WeeklyCompetitionType {
  const kind = classifyMetric(metric);
  if (kind === "skill") return "sotw";
  if (kind === "boss") return "botw";
  return /skill of the week/i.test(title) ? "sotw" : "botw";
}

/** "The Gauntlet / Corrupted Gauntlet" for a multi-competition week -- each title reduced to its bare skill/boss name. */
function combinedName(comps: PickableCompetition[]): string {
  return [...new Set(comps.map((c) => bareCompetitionName(c.title)))].join(" / ");
}

export interface TurnoverPreview {
  results: { channelId: string; content: string } | null;
  forum: { channelId: string; title: string; content: string };
  raffle: { channelId: string; content: string } | null;
  /** The next-next week's vote, posted in the voting thread. */
  poll: { channelId: string; question: string; answers: string[]; durationHours: number } | null;
  nextEmoji: string;
  nextIds: number[];
  nextType: WeeklyCompetitionType;
  nextName: string;
  startDate: string; // ISO instant the new competition starts
  warnings: string[];
}

/** Top N by gains, summing per player across ids for a dual-BotW week. */
async function computeCombinedLeaders(womIds: number[], limit: number): Promise<WeeklyLeader[]> {
  if (womIds.length === 0) return [];
  if (womIds.length === 1) return getCompetitionLeaders(womIds[0], limit);

  const totals = new Map<string, number>();
  for (const womId of womIds) {
    const full = await getCompetitionLeaders(womId, FULL_LEADERBOARD_LIMIT);
    for (const p of full) totals.set(p.displayName, (totals.get(p.displayName) ?? 0) + p.gained);
  }
  return [...totals.entries()]
    .map(([displayName, gained]) => ({ displayName, gained }))
    .sort((a, b) => b.gained - a.gained)
    .slice(0, limit);
}

/** Per-placement GP from the Payouts page's default prize structure (explicit placements, then the default amount). */
export async function getPrizeStructure(supabase: SupabaseClient): Promise<PrizeStructure> {
  const { data } = await supabase.from("payout_prize_defaults").select("placements, default_amount").eq("id", 1).maybeSingle();
  const placements: { placement: number; amount: number }[] = Array.isArray(data?.placements) ? data.placements : [];
  const defaultAmount = Number(data?.default_amount ?? 500_000);
  return Array.from({ length: WINNER_COUNT }, (_, i) => {
    const explicit = placements.find((p) => Number(p.placement) === i + 1);
    return explicit ? Number(explicit.amount) : defaultAmount;
  });
}

export async function buildTurnoverPreview(
  supabase: SupabaseClient,
  config: WeeklyConfig,
  input: {
    finishedIds: number[];
    nextIds: number[];
    previousThreadId: string | null;
    raffleWinners: string[];
    raffleAmount: number;
    pingRoleIds: string[];
    votingThreadId: string | null;
    pollOptions: string[];
  }
): Promise<TurnoverPreview> {
  const warnings: string[] = [];

  const groupCompetitions = await getPickableCompetitions();
  const pick = (ids: number[]) => ids.map((id) => groupCompetitions.find((c) => c.id === id)).filter((c): c is PickableCompetition => !!c);
  const finished = pick(input.finishedIds);
  const next = pick(input.nextIds);
  if (finished.length !== input.finishedIds.length || next.length !== input.nextIds.length) {
    throw new Error("One of the picked competitions isn't in the clan's WOM group (or is more than a few weeks old) -- refresh and pick again.");
  }
  if (finished.length === 0) throw new Error("Pick the competition(s) that just finished.");
  if (next.length === 0) throw new Error("Pick next week's competition(s).");

  const finishedType = competitionType(finished[0].metric, finished[0].title);
  const finishedName = combinedName(finished);
  const nextType = competitionType(next[0].metric, next[0].title);
  const nextName = combinedName(next);

  const [announcementsChannelId, forumChannelId] = await Promise.all([
    getAlertChannel(supabase, "weekly_competition_announcements"),
    getAlertChannel(supabase, "skill_or_kill_forum"),
  ]);
  if (!forumChannelId) throw new Error("No Skill or Kill of the Week Forum channel configured. Set one under Admin > Settings > Discord Channels.");
  if (!announcementsChannelId && input.raffleWinners.length) {
    throw new Error("No Weekly SOTW/BotW Announcements channel configured for the raffle post. Set one under Admin > Settings > Discord Channels.");
  }

  const prizes = await getPrizeStructure(supabase);
  const [leaders, text] = await Promise.all([
    computeCombinedLeaders(input.finishedIds, prizes.length + 1),
    generateWeeklyAnnouncementText({ finishedType, finishedName, nextType, nextName }),
  ]);

  // Dates come from WOM's own start/end, so the post always matches the competition page.
  const startDate = new Date(next[0].startsAt);
  const endDate = new Date(next[0].endsAt);
  const finishedStart = new Date(finished[0].startsAt);
  if (new Date(finished[0].endsAt).getTime() > Date.now()) {
    warnings.push(`"${finished[0].title}" hasn't ended yet -- the results are the current standings, not final.`);
  }

  const nextCompetitionNames = next.map((c) => bareCompetitionName(c.title));

  // The stored emoji belongs to whatever the last turnover posted -- only reuse it for that same competition.
  const sameAsStored = [...input.finishedIds].sort().join(",") === [...(config.current_competition_ids ?? [])].sort().join(",");
  const finishedEmoji = (sameAsStored && config.current_competition_emoji) || text.finishedEmoji;
  const nextEmoji = text.nextEmoji;

  let results: TurnoverPreview["results"] = null;
  if (input.previousThreadId) {
    if (leaders.length === 0) warnings.push("WOM returned no standings for this week's competition -- the results list is empty.");
    results = {
      channelId: input.previousThreadId,
      content: buildResultsMessage({
        type: finishedType,
        competitionName: finishedName,
        emoji: finishedEmoji,
        startDate: finishedStart,
        leaders,
        prizes,
        intro: text.resultsIntro,
        pingMentions: formatRolePingMentions(input.pingRoleIds),
        nextType,
        nextName,
        nextEmoji,
        forumChannelId,
      }),
    };
  } else {
    warnings.push("No previous forum thread set -- the results post will be skipped.");
  }

  const forumPost = buildForumPost({
    type: nextType,
    competitionName: nextName,
    emoji: nextEmoji,
    startDate,
    endDate,
    competitionIds: input.nextIds,
    competitionNames: nextCompetitionNames,
    prizes,
    intro: text.forumIntro,
    guideSection: buildForumGuideSection(nextType, nextName, text.guideHeading, text.guide),
    tipsSection: buildForumTipsSection(text.tips),
    announcementsChannelId,
  });
  if (!text.guide.length || !text.tips.length) warnings.push("The guide/tips couldn't be generated -- fill them in before posting.");

  let raffle: TurnoverPreview["raffle"] = null;
  if (input.raffleWinners.length && announcementsChannelId) {
    raffle = {
      channelId: announcementsChannelId,
      content: buildRaffleMessage({
        winners: input.raffleWinners,
        prizeAmount: input.raffleAmount,
        finishedType,
        finishedName,
        resultsThreadId: input.previousThreadId,
      }),
    };
  } else {
    warnings.push("No raffle winners entered -- the raffle post will be skipped.");
  }

  // The vote for the week after the new one -- the opposite type, since
  // weeks alternate between skills and bosses.
  let poll: TurnoverPreview["poll"] = null;
  if (input.votingThreadId && input.pollOptions.length >= 2) {
    poll = {
      channelId: input.votingThreadId,
      question: buildPollQuestion(oppositeType(nextType), new Date(startDate.getTime() + WEEK_MS)),
      answers: input.pollOptions,
      durationHours: POLL_DURATION_HOURS,
    };
  } else if (!input.votingThreadId) {
    warnings.push("No voting thread set -- the voting poll will be skipped.");
  } else {
    warnings.push("Enter at least 2 poll options -- the voting poll will be skipped.");
  }

  return {
    results,
    forum: { channelId: forumChannelId, title: forumPost.title, content: forumPost.content },
    raffle,
    poll,
    nextEmoji,
    nextIds: input.nextIds,
    nextType,
    nextName,
    startDate: startDate.toISOString(),
    warnings,
  };
}
