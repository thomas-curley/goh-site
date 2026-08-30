// Pure formatting/template functions for the weekly SOTW/BotW announcement
// automation -- no Discord- or DB-specific logic here, just string building,
// so the output can be eyeballed/tested by calling these directly.

export type WeeklyCompetitionType = "sotw" | "botw";

export interface WeeklyLeader {
  displayName: string;
  gained: number;
}

const PRIZE_AMOUNTS = [6_500_000, 4_000_000, 2_000_000, 500_000, 500_000, 500_000, 500_000, 500_000, 500_000, 500_000];
const RANK_LABELS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th"];
const RANK_MEDALS = ["🥇", "🥈", "🥉"];
const TOTAL_PRIZE_POOL = 16_000_000;

const TYPE_LABEL: Record<WeeklyCompetitionType, string> = {
  sotw: "SKILL OF THE WEEK",
  botw: "BOSS OF THE WEEK",
};

const TYPE_EMOJI: Record<WeeklyCompetitionType, string> = {
  sotw: "📊🌿",
  botw: "⚔️🌿",
};

export function formatGp(n: number): string {
  return n.toLocaleString("en-US");
}

/** "+1,741k XP" under 1M, "+1.2m XP" at/above 1M. */
export function formatXpGained(n: number): string {
  if (n >= 1_000_000) return `+${(n / 1_000_000).toFixed(1)}m XP`;
  return `+${Math.round(n / 1000).toLocaleString("en-US")}k XP`;
}

/** "+63 KC" */
export function formatKcGained(n: number): string {
  return `+${Math.round(n)} KC`;
}

function formatGained(type: WeeklyCompetitionType, n: number): string {
  return type === "sotw" ? formatXpGained(n) : formatKcGained(n);
}

// All date formatting below reads UTC components explicitly (never the
// runtime's local timezone) so output is identical regardless of what
// timezone the server process happens to be running in. Callers are
// expected to pass in a Date already shifted to represent the intended EDT
// calendar day -- see toEdtCalendarDate().
const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/**
 * The cron fires at UTC midnight Monday, which is 8PM EDT Sunday -- for
 * display purposes ("Start: Sunday...") we want the EDT calendar day, not
 * the UTC one. Shifts by -4h (EDT offset; see the plan's DST caveat) before
 * any UTC-getter-based formatting below extracts date parts.
 */
export function toEdtCalendarDate(d: Date): Date {
  return new Date(d.getTime() - 4 * 60 * 60 * 1000);
}

/** "8/23" -- no leading zeros. */
export function formatShortDate(d: Date): string {
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

/** "Sunday, August 24" */
export function formatLongDate(d: Date): string {
  return `${WEEKDAY_NAMES[d.getUTCDay()]}, ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function nextDayName(d: Date): string {
  return WEEKDAY_NAMES[(d.getUTCDay() + 1) % 7];
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}

export function womCompetitionUrl(id: number): string {
  return `https://wiseoldman.net/competitions/${id}`;
}

function prizeLines(labelFn: (rank: string) => string): string {
  return [
    `🥇 ${labelFn("1st")} — ${formatGp(PRIZE_AMOUNTS[0])} GP`,
    `🥈 ${labelFn("2nd")} — ${formatGp(PRIZE_AMOUNTS[1])} GP`,
    `🥉 ${labelFn("3rd")} — ${formatGp(PRIZE_AMOUNTS[2])} GP`,
    `${labelFn("4th — 10th")} — ${formatGp(PRIZE_AMOUNTS[3])} GP each`,
  ].join("\n");
}

/** One or two competition links, formatted per the dual-BotW spec. */
function competitionLinkLines(ids: number[], names: string[]): string {
  if (ids.length <= 1) {
    return `🔗 Competition link: ${womCompetitionUrl(ids[0])}`;
  }
  return ids.map((id, i) => `🔗 ${names[i] ?? `Competition ${i + 1}`}: ${womCompetitionUrl(id)}`).join("\n");
}

export function buildResultsMessage(params: {
  type: WeeklyCompetitionType;
  competitionName: string;
  weekStartDate: Date;
  leaders: WeeklyLeader[]; // already sorted descending, capped to 10
  flavourLine: string;
  nextCompetitionName: string | null;
}): string {
  const { type, competitionName, weekStartDate, leaders, flavourLine, nextCompetitionName } = params;
  const emoji = TYPE_EMOJI[type];
  const label = TYPE_LABEL[type];
  const date = formatShortDate(weekStartDate);

  const resultLines = leaders.map((leader, i) => {
    const medal = RANK_MEDALS[i];
    const rank = RANK_LABELS[i];
    const prefix = medal ? `${medal} ${rank}` : rank;
    return `${prefix} — ${leader.displayName} — ${formatGained(type, leader.gained)} — ${formatGp(PRIZE_AMOUNTS[i])} GP`;
  });

  const nextWeekLine = nextCompetitionName
    ? `Next up: **${nextCompetitionName}**! Details in #skill-or-kill-of-the-week.`
    : `Details on next week in #skill-or-kill-of-the-week.`;

  return [
    "@everyone",
    `${emoji} ${label} — ${date} RESULTS — ${competitionName} ${emoji}`,
    flavourLine,
    ...resultLines,
    `Congratulations to all ${leaders.length} — prizes will be distributed in-game shortly. 🌿`,
    nextWeekLine,
    "— Much Love from the Trees and Hats",
  ].join("\n");
}

export function buildNewWeekMessage(params: {
  type: WeeklyCompetitionType;
  competitionName: string;
  startDate: Date;
  competitionIds: number[];
  competitionNames?: string[];
  intro: string;
}): string {
  const { type, competitionName, startDate, competitionIds, competitionNames = [], intro } = params;
  const emoji = TYPE_EMOJI[type];
  const label = TYPE_LABEL[type];
  const date = formatShortDate(startDate);

  return [
    "@Event Pings",
    `${emoji} ${label} — ${date} — ${competitionName} ${emoji}`,
    intro,
    `📅 Start: ${formatLongDate(startDate)} @ 8PM EDT | 12AM UTC ${nextDayName(startDate)} (Jagex Time)`,
    competitionLinkLines(competitionIds, competitionNames),
    `💰 Prize Pool — ${formatGp(TOTAL_PRIZE_POOL)} GP — 10 Winners`,
    prizeLines((rank) => `${rank} Place`),
    "Full details and tips in #skill-or-kill-of-the-week.",
    "— Much Love from the Trees and Hats",
  ].join("\n");
}

export function buildForumPost(params: {
  type: WeeklyCompetitionType;
  competitionName: string;
  startDate: Date;
  competitionIds: number[];
  competitionNames?: string[];
  intro: string;
}): { title: string; content: string } {
  const { type, competitionName, startDate, competitionIds, competitionNames = [], intro } = params;
  const emoji = TYPE_EMOJI[type];
  const label = TYPE_LABEL[type];
  const shortDate = formatShortDate(startDate);
  const endDate = addDays(startDate, 7);
  const divider = "━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

  const title = `${competitionName} — ${shortDate}`;

  const content = [
    `${emoji} ${label} — ${shortDate} — ${competitionName} ${emoji}`,
    intro,
    divider,
    `📅 Start: ${formatLongDate(startDate)} @ 8PM EDT | 12AM UTC ${nextDayName(startDate)} (Jagex Time)`,
    `🏁 End: ${formatLongDate(endDate)} @ 8PM EDT | 12AM UTC ${nextDayName(endDate)}`,
    competitionLinkLines(competitionIds, competitionNames),
    divider,
    `💰 Prize Pool — ${formatGp(TOTAL_PRIZE_POOL)} GP — 10 Winners`,
    prizeLines((rank) => `${rank} Place`),
    "Prizes distributed in-game by the Gnome Council. Winners announced in #announcements.",
    divider,
    "📝 How it works",
    "🌿 Your account must be in the Gn0me Home WOM group to be tracked",
    "🌿 XP/KC gains are counted from the moment the competition starts",
    "🌿 One entry per person — no matter how many accounts you play on",
    "🌿 You must be an active clan member to be eligible for prizes",
    divider,
    "<!-- ADD TIPS SECTION HERE -->",
    "🎉 Don't forget the weekly raffle",
    "Show up to events this week and check in on the website to earn raffle entries. More events = more entries = more chances to win at the end of the week.",
    divider,
    "Good luck out there — Much Love from the Trees and Hats",
  ].join("\n");

  return { title, content };
}
