// Pure formatting/template functions for the weekly SOTW/BotW turnover posts
// -- no Discord- or DB-specific logic here, just string building, so the
// output can be eyeballed/tested by calling these directly. Formats mirror
// the hand-written posts the clan was already making:
//   1. Results -- a reply in LAST week's forum thread
//   2. The new week's forum thread (header, dates, prizes, guide, tips)
//   3. Raffle winners -- in the announcements channel, linking back to (1)

export type WeeklyCompetitionType = "sotw" | "botw";

export interface WeeklyLeader {
  displayName: string;
  gained: number;
}

/** One entry per paid placement, 1st first -- read from the Payouts page's default prize structure. */
export type PrizeStructure = number[];

const RANK_MEDALS = ["🥇", "🥈", "🥉"];

const TYPE_LABEL: Record<WeeklyCompetitionType, string> = {
  sotw: "SKILL OF THE WEEK",
  botw: "BOSS OF THE WEEK",
};

const TYPE_TITLE: Record<WeeklyCompetitionType, string> = {
  sotw: "Skill of the Week",
  botw: "Boss of the Week",
};

export const DIVIDER = "______________________________";

export function formatGp(n: number): string {
  return Math.round(n).toLocaleString("en-US");
}

/** "+741k XP" under 1M, "+1.2m XP" at/above 1M. */
export function formatXpGained(n: number): string {
  if (n >= 1_000_000) return `+${(n / 1_000_000).toFixed(1)}m XP`;
  return `+${Math.round(n / 1000).toLocaleString("en-US")}k XP`;
}

/** "+63 KC" */
export function formatKcGained(n: number): string {
  return `+${Math.round(n).toLocaleString("en-US")} KC`;
}

function formatGained(type: WeeklyCompetitionType, n: number): string {
  return type === "sotw" ? formatXpGained(n) : formatKcGained(n);
}

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1: return `${n}st`;
    case 2: return `${n}nd`;
    case 3: return `${n}rd`;
    default: return `${n}th`;
  }
}

// --- Dates ------------------------------------------------------------------
// Competitions start/end at 00:00 UTC Monday ("Jagex time"), which is Sunday
// evening in New York. Everything below formats real instants via Intl with
// explicit time zones, so the output is right in both EDT and EST and doesn't
// depend on the server's own time zone.

const NY = "America/New_York";

function zonedParts(d: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "long",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const monthNumber = Number(new Intl.DateTimeFormat("en-US", { timeZone, month: "numeric" }).format(d));
  return {
    weekday: get("weekday"),
    month: get("month"),
    monthNumber,
    day: Number(get("day")),
    hour: Number(get("hour")),
    minute: get("minute"),
    dayPeriod: get("dayPeriod"),
    zone: get("timeZoneName"),
  };
}

function formatClock(p: { hour: number; minute: string; dayPeriod: string }): string {
  return `${p.hour}${p.minute === "00" ? "" : `:${p.minute}`}${p.dayPeriod}`;
}

/** "10/11" -- the New York calendar date of the instant, no leading zeros. */
export function formatShortDate(d: Date): string {
  const p = zonedParts(d, NY);
  return `${p.monthNumber}/${p.day}`;
}

/** "Sunday October 11th @ 8PM EDT | 12AM UTC October 12th" */
export function formatStartEnd(d: Date): string {
  const ny = zonedParts(d, NY);
  const utc = zonedParts(d, "UTC");
  return `${ny.weekday} ${ny.month} ${ordinal(ny.day)} @ ${formatClock(ny)} ${ny.zone} | ${formatClock(utc)} UTC ${utc.month} ${ordinal(utc.day)}`;
}

/**
 * The 00:00 UTC Monday this turnover belongs to -- the fallback competition
 * start when WOM doesn't give us one. Shifted back 12h first so running it
 * just after the boundary (Sunday 8:18PM EDT is already Monday 00:18 UTC)
 * still lands on the Monday that just began rather than next week's.
 */
export function nextJagexWeekStart(from: Date): Date {
  const shifted = new Date(from.getTime() - 12 * 60 * 60 * 1000);
  const d = new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + ((8 - d.getUTCDay()) % 7));
  return d;
}

/**
 * The bare skill/boss from a stored competition name, since admins often
 * paste the full WOM title ("Skill of the Week | 10/11 | Fletching", "10/11 -
 * SKILL OF THE WEEK - FLETCHING") where the templates only want "Fletching"
 * (they add the date and label themselves). All-caps input is title-cased.
 */
export function bareCompetitionName(name: string): string {
  const trimmed = name.trim();
  const DATE = /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/g;
  const LABEL = /\b(skill|boss|kill)\s+of\s+the\s+week\b/gi;
  // A plain name ("TzKal-Zuk", "Chambers of Xeric: Challenge Mode") is left alone.
  if (!trimmed.match(DATE) && !trimmed.match(LABEL)) return trimmed;

  // Turn the date/label into "|" breaks, then trim the separators left around them.
  const bare = trimmed
    .replace(DATE, "|")
    .replace(LABEL, "|")
    .split("|")
    .map((part) => part.replace(/^[\s\-—–:]+|[\s\-—–:]+$/g, ""))
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  if (!bare) return trimmed;
  return bare === bare.toUpperCase() ? bare.toLowerCase().replace(/(^|[\s-])[a-z]/g, (c) => c.toUpperCase()) : bare;
}

export function womCompetitionUrl(id: number): string {
  return `https://wiseoldman.net/competitions/${id}`;
}

// --- 1. Results (reply in last week's thread) --------------------------------

export function buildResultsMessage(params: {
  type: WeeklyCompetitionType;
  competitionName: string;
  emoji: string;
  startDate: Date;
  leaders: WeeklyLeader[]; // sorted descending; may include one past the prize places for the shoutout
  prizes: PrizeStructure;
  intro: string;
  pingMentions: string;
  nextType: WeeklyCompetitionType;
  nextName: string;
  nextEmoji: string;
  forumChannelId: string | null;
}): string {
  const { type, competitionName, emoji, startDate, leaders, prizes, intro, pingMentions, nextType, nextName, nextEmoji, forumChannelId } = params;
  const winners = leaders.slice(0, prizes.length);
  const runnerUp = leaders[prizes.length];

  const resultLines = winners.map((leader, i) => {
    const medal = RANK_MEDALS[i];
    const label = `**${ordinal(i + 1)} — ${leader.displayName}**`;
    return `${medal ? `${medal} ` : ""}${label} — ${formatGained(type, leader.gained)} — ${formatGp(prizes[i])} GP`;
  });

  const blocks = [
    `${emoji}🌿 **${TYPE_LABEL[type]} — ${formatShortDate(startDate)} RESULTS — ${competitionName.toUpperCase()}** 🌿${emoji}`,
    intro,
    resultLines.join("\n"),
    `Congratulations to all ${winners.length} — prizes will be distributed in-game shortly. 🌿`,
  ];
  if (pingMentions) blocks.unshift(pingMentions);
  if (runnerUp && runnerUp.gained > 0) {
    blocks.push(`Shoutout to ${runnerUp.displayName} just outside the top ${winners.length} with ${formatGained(type, runnerUp.gained)} — keep showing up.`);
  }
  blocks.push(
    `${nextEmoji} **Up next — ${TYPE_TITLE[nextType]}: ${nextName}.** Details in ${forumChannelId ? `<#${forumChannelId}>` : "#skill-or-kill-of-the-week"}.`,
    "— Much Love from the Trees and Keys"
  );
  return blocks.join("\n\n");
}

// --- 2. New week's forum thread ----------------------------------------------

export interface GuideEntry {
  heading: string; // "1–20 — Arrow shafts & Shortbows"
  body: string;
  bullets?: string[];
}

export interface TipEntry {
  lead: string; // bolded
  text: string;
}

export function buildForumGuideSection(type: WeeklyCompetitionType, competitionName: string, guideHeading: string | null, entries: GuideEntry[]): string {
  const heading = guideHeading || (type === "sotw" ? `Best ${competitionName} methods by level` : `How to take on ${competitionName}`);
  const body = entries.length
    ? entries.map((e) => [`🌿 **${e.heading}**`, e.body, ...(e.bullets ?? []).map((b) => `› ${b}`)].filter(Boolean).join("\n")).join("\n\n")
    : "🌿 **(add methods here)**";
  return `🔥 **${heading}**\n\n${body}`;
}

export function buildForumTipsSection(tips: TipEntry[]): string {
  const body = tips.length ? tips.map((t) => `🌿 **${t.lead}** — ${t.text}`).join("\n") : "🌿 **(add tips here)**";
  return `💡 **Tips**\n\n${body}`;
}

export function buildForumTitle(type: WeeklyCompetitionType, competitionName: string, startDate: Date): string {
  return `${formatShortDate(startDate)} — ${TYPE_LABEL[type]} — ${competitionName.toUpperCase()}`;
}

export function buildForumPost(params: {
  type: WeeklyCompetitionType;
  competitionName: string;
  emoji: string;
  startDate: Date;
  endDate: Date;
  competitionIds: number[];
  competitionNames: string[];
  prizes: PrizeStructure;
  intro: string;
  guideSection: string;
  tipsSection: string;
  announcementsChannelId: string | null;
}): { title: string; content: string } {
  const { type, competitionName, emoji, startDate, endDate, competitionIds, competitionNames, prizes, intro, guideSection, tipsSection, announcementsChannelId } = params;

  const linkLines =
    competitionIds.length <= 1
      ? [`🔗 **Competition link:** ${womCompetitionUrl(competitionIds[0])}`]
      : competitionIds.map((id, i) => `🔗 **${competitionNames[i] ?? `Competition ${i + 1}`}:** ${womCompetitionUrl(id)}`);

  const totalPool = prizes.reduce((sum, n) => sum + n, 0);
  const prizeLines = prizes.map((amount, i) => `${RANK_MEDALS[i] ? `${RANK_MEDALS[i]} ` : ""}${ordinal(i + 1)} Place — ${formatGp(amount)} GP`);

  const gainsWord = type === "sotw" ? "XP" : "KC";

  const content = [
    `${emoji} **${TYPE_LABEL[type]} — ${formatShortDate(startDate)} — ${competitionName.toUpperCase()}** ${emoji}`,
    intro,
    DIVIDER,
    [
      `📅 **Start:** ${formatStartEnd(startDate)} (Jagex Time)`,
      `🏁 **End:** ${formatStartEnd(endDate)}`,
      ...linkLines,
    ].join("\n"),
    DIVIDER,
    [`💰 **Prize Pool — ${formatGp(totalPool)} GP — ${prizes.length} Winners**`, ...prizeLines].join("\n"),
    `Prizes distributed in-game by the Gnome Council at the end of the week. Winners announced in ${announcementsChannelId ? `<#${announcementsChannelId}>` : "#announcements"}.`,
    DIVIDER,
    [
      "📝 **How it works**",
      "🌿 Your account must be in the Gn0me Home WOM group to be tracked",
      `🌿 ${gainsWord} gains are counted from the moment the competition starts`,
      "🌿 One entry per person — no matter how many accounts you play on",
      "🌿 You must be an active clan member to be eligible for prizes",
    ].join("\n"),
    DIVIDER,
    guideSection,
    DIVIDER,
    tipsSection,
    DIVIDER,
    [
      "🎉 **Don't forget the weekly raffle**",
      "Show up to events this week and check in on the website to earn raffle entries. More events = more entries = more chances to win at the end of the week.",
    ].join("\n"),
    DIVIDER,
    "Good luck out there — Much Love from the Trees and Hats",
  ].join("\n\n");

  return { title: buildForumTitle(type, competitionName, startDate), content };
}

// --- 3. Raffle winners (announcements channel) -------------------------------

export function buildRaffleMessage(params: {
  winners: string[];
  prizeAmount: number;
  finishedType: WeeklyCompetitionType;
  finishedName: string;
  resultsThreadId: string | null;
}): string {
  const { winners, prizeAmount, finishedType, finishedName, resultsThreadId } = params;
  const plural = winners.length !== 1;

  const blocks = [
    "🎉🌿 **WEEKLY RAFFLE WINNERS** 🌿🎉",
    plural
      ? `Congratulations to this week's raffle winners — each taking home ${formatGp(prizeAmount)} GP:`
      : `Congratulations to this week's raffle winner — taking home ${formatGp(prizeAmount)} GP:`,
    winners.map((w) => `🌿 ${w}`).join("\n"),
    "Prizes will be distributed in-game shortly!",
  ];
  if (resultsThreadId) {
    blocks.push(
      `Also — the **${finishedName} ${TYPE_TITLE[finishedType]} results** are posted. Head over to see how the final leaderboard shook out → <#${resultsThreadId}>`
    );
  }
  blocks.push("*Show up to events and check in on gn0mehome.com each week to earn raffle entries!*", "— Much Love from the Trees and Keys");
  return blocks.join("\n\n");
}

// --- 4. Voting poll (voting thread) -------------------------------------------

/**
 * The type the poll opened at a turnover votes on: the clan alternates, so
 * the week after a Skill of the Week is a Boss of the Week and vice versa.
 */
export function oppositeType(type: WeeklyCompetitionType): WeeklyCompetitionType {
  return type === "sotw" ? "botw" : "sotw";
}

/** "What Should Boss Of The Week Be for 10/18" -- matches the hand-made polls. */
export function buildPollQuestion(type: WeeklyCompetitionType, weekStart: Date): string {
  return `What Should ${type === "sotw" ? "Skill" : "Boss"} Of The Week Be for ${formatShortDate(weekStart)}`;
}

// --- Splitting ---------------------------------------------------------------

/** Discord's per-message content limit for bots. */
export const DISCORD_MESSAGE_LIMIT = 2000;

/**
 * Splits a long post into Discord-sized messages. The full forum post runs
 * well past 2000 characters, so the thread gets a starter message plus
 * follow-ups. Breaks only between paragraphs (preferring right after a
 * divider, so each message ends on a clean section break), and falls back
 * to line breaks only for a single paragraph that's too long on its own.
 */
export function splitDiscordMessage(content: string, limit = DISCORD_MESSAGE_LIMIT): string[] {
  if (content.length <= limit) return [content];

  // Sections end at (and include) a divider paragraph.
  const paragraphs = content.split("\n\n");
  const sections: string[][] = [[]];
  for (const p of paragraphs) {
    sections[sections.length - 1].push(p);
    if (p.trim() === DIVIDER) sections.push([]);
  }

  const pieces: string[] = [];
  for (const section of sections.filter((s) => s.length)) {
    const joined = section.join("\n\n");
    if (joined.length <= limit) {
      pieces.push(joined);
      continue;
    }
    for (const p of section) {
      if (p.length <= limit) {
        pieces.push(p);
        continue;
      }
      let buf = "";
      for (const line of p.split("\n")) {
        const candidate = buf ? `${buf}\n${line}` : line;
        if (candidate.length > limit && buf) {
          pieces.push(buf);
          buf = line.slice(0, limit);
        } else {
          buf = candidate.slice(0, limit);
        }
      }
      if (buf) pieces.push(buf);
    }
  }

  // Greedily pack pieces back together.
  const messages: string[] = [];
  for (const piece of pieces) {
    const last = messages[messages.length - 1];
    if (last !== undefined && last.length + 2 + piece.length <= limit) {
      messages[messages.length - 1] = `${last}\n\n${piece}`;
    } else {
      messages.push(piece);
    }
  }
  return messages;
}
