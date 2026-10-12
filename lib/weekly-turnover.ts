import type { SupabaseClient } from "@supabase/supabase-js";
import { getCompetitionLeaders, getGroupCompetitions } from "@/lib/wom";
import { getAlertChannel } from "@/lib/alert-channels";
import { formatRolePingMentions } from "@/lib/post-templates";
import { generateWeeklyAnnouncementText } from "@/lib/weekly-announcement-text";
import {
  bareCompetitionName,
  buildForumGuideSection,
  buildForumPost,
  buildForumTipsSection,
  buildRaffleMessage,
  buildResultsMessage,
  nextJagexWeekStart,
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

export interface WeeklyConfig {
  current_competition_ids: number[];
  current_competition_type: WeeklyCompetitionType | null;
  current_competition_name: string | null;
  current_week_start_date: string | null;
  current_forum_thread_id: string | null;
  current_competition_emoji: string | null;
  next_competition_ids: number[];
  next_competition_type: WeeklyCompetitionType | null;
  next_competition_name: string | null;
  ping_role_ids: string[] | null;
  raffle_prize_amount: number | string | null;
  last_run_at: string | null;
}

export interface TurnoverPreview {
  results: { channelId: string; content: string } | null;
  forum: { channelId: string; title: string; content: string };
  raffle: { channelId: string; content: string } | null;
  nextEmoji: string;
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
  input: { previousThreadId: string | null; raffleWinners: string[]; raffleAmount: number; pingRoleIds: string[] }
): Promise<TurnoverPreview> {
  const warnings: string[] = [];
  const finishedType = config.current_competition_type!;
  const finishedName = bareCompetitionName(config.current_competition_name ?? "Competition");
  const nextType = config.next_competition_type!;
  const nextName = bareCompetitionName(config.next_competition_name ?? "Competition");

  const [announcementsChannelId, forumChannelId] = await Promise.all([
    getAlertChannel(supabase, "weekly_competition_announcements"),
    getAlertChannel(supabase, "skill_or_kill_forum"),
  ]);
  if (!forumChannelId) throw new Error("No Skill or Kill of the Week Forum channel configured. Set one under Admin > Alert Channels.");
  if (!announcementsChannelId && input.raffleWinners.length) {
    throw new Error("No Weekly SOTW/BotW Announcements channel configured for the raffle post. Set one under Admin > Alert Channels.");
  }

  const prizes = await getPrizeStructure(supabase);
  const [leaders, text, groupCompetitions] = await Promise.all([
    computeCombinedLeaders(config.current_competition_ids, prizes.length + 1),
    generateWeeklyAnnouncementText({ finishedType, finishedName, nextType, nextName }),
    getGroupCompetitions(),
  ]);

  const findComp = (id: number | undefined) => (id == null ? undefined : groupCompetitions.find((c) => c.id === id));

  // Dates come from WOM's own start/end when available, so the post always
  // matches the competition page.
  const nextComp = findComp(config.next_competition_ids[0]);
  const startDate = nextComp ? new Date(nextComp.startsAt) : nextJagexWeekStart(new Date());
  const endDate = nextComp ? new Date(nextComp.endsAt) : new Date(startDate.getTime() + WEEK_MS);
  if (!nextComp) warnings.push("Couldn't find next week's competition in the WOM group -- dates were calculated, double-check them.");

  const currentComp = findComp(config.current_competition_ids[0]);
  const finishedStart = currentComp
    ? new Date(currentComp.startsAt)
    : config.current_week_start_date
      ? new Date(`${config.current_week_start_date}T12:00:00Z`)
      : new Date(startDate.getTime() - WEEK_MS);

  const nextCompetitionNames = config.next_competition_ids.map((id, i) => findComp(id)?.title ?? `${nextName} (Part ${i + 1})`);

  const finishedEmoji = config.current_competition_emoji || text.finishedEmoji;
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
    competitionIds: config.next_competition_ids,
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

  return {
    results,
    forum: { channelId: forumChannelId, title: forumPost.title, content: forumPost.content },
    raffle,
    nextEmoji,
    startDate: startDate.toISOString(),
    warnings,
  };
}
