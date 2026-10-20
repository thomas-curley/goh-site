import catalog from "@/content/osrs-quests.json";

// Quest events: the quest list, which quests an event counts, scoring and
// standings. Shared by the server and the pages. The list is built from the
// OSRS Wiki by scripts/osrs-quests (see .github/workflows/osrs-quests.yml),
// with quest names as WikiSync reports them.

export const DIFFICULTIES = ["Novice", "Intermediate", "Experienced", "Master", "Grandmaster", "Special"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export interface Quest {
  name: string;
  wikiPage: string;
  difficulty: Difficulty;
  qp: number;
  members: boolean;
  miniquest: boolean;
  length: string | null;
  series: string | null;
}

export const QUESTS: Quest[] = (catalog.quests as Quest[]).map((q) => ({ ...q, difficulty: (DIFFICULTIES as readonly string[]).includes(q.difficulty) ? q.difficulty : "Special" }));
export const QUEST_BY_NAME = new Map(QUESTS.map((q) => [q.name, q]));

/**
 * Recipe for Disaster is listed both whole and as its ten sub-quests, which
 * carry its quest points. "All quests" counts the sub-quests; staff can
 * still pick the whole quest for a list.
 */
const NOT_IN_ALL = new Set(["Recipe for Disaster"]);

export function wikiUrl(q: Pick<Quest, "wikiPage">): string {
  return `https://oldschool.runescape.wiki/w/${encodeURIComponent(q.wikiPage.replace(/ /g, "_"))}`;
}

export type QuestEventStatus = "draft" | "signups" | "active" | "completed";
export type QuestScoring = "difficulty" | "qp" | "flat";

export interface QuestEvent {
  id: string;
  name: string;
  description: string | null;
  rules: string | null;
  banner_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: QuestEventStatus;
  format: "solo" | "teams";
  scoring: QuestScoring;
  difficulty_points: Record<string, number>;
  flat_points: number;
  quest_names: string[];
  include_miniquests: boolean;
  /** Everyone in the clan takes part, including people who join during the event. */
  auto_add_members: boolean;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuestTeam {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
}

export interface QuestParticipant {
  id: string;
  user_id: string | null;
  rsn: string;
  team_id: string | null;
  is_captain: boolean;
  has_wikisync: boolean | null;
  quests_done: number | null;
  baseline_at: string | null;
  last_checked_at: string | null;
  joined_at: string;
}

export interface QuestCompletion {
  participant_id: string;
  quest_name: string;
  source: "wikisync" | "proof" | "staff" | "broadcast";
  completed_at: string;
}

export const DEFAULT_DIFFICULTY_POINTS: Record<Difficulty, number> = { Novice: 1, Intermediate: 2, Experienced: 3, Master: 4, Grandmaster: 5, Special: 2 };

export const STATUS_LABELS: Record<QuestEventStatus, string> = { draft: "Draft", signups: "Sign-ups open", active: "Live", completed: "Finished" };

/** The quests this event counts, in list order. */
export function eventQuests(event: Pick<QuestEvent, "quest_names" | "include_miniquests">): Quest[] {
  if (event.quest_names.length > 0) {
    const chosen = new Set(event.quest_names);
    return QUESTS.filter((q) => chosen.has(q.name));
  }
  return QUESTS.filter((q) => !NOT_IN_ALL.has(q.name) && (event.include_miniquests || !q.miniquest));
}

/** Points a quest is worth in this event. */
export function questPoints(event: Pick<QuestEvent, "scoring" | "difficulty_points" | "flat_points">, quest: Pick<Quest, "difficulty" | "qp">): number {
  if (event.scoring === "flat") return event.flat_points;
  if (event.scoring === "qp") return quest.qp;
  return Number(event.difficulty_points?.[quest.difficulty] ?? DEFAULT_DIFFICULTY_POINTS[quest.difficulty] ?? 0);
}

export interface Standing {
  id: string; // participant id (solo) or team id (teams)
  name: string;
  color: string | null;
  points: number;
  quests: number;
  lastAt: string | null;
  members: number;
}

/**
 * Leaderboard rows, best first: total points, then quests, then whoever got
 * there first. Only completions of quests the event counts are scored.
 */
export function computeStandings(event: QuestEvent, participants: QuestParticipant[], teams: QuestTeam[], completions: QuestCompletion[]): Standing[] {
  const counted = new Map(eventQuests(event).map((q) => [q.name, q]));
  const byParticipant = new Map<string, { points: number; quests: number; lastAt: string | null }>();
  for (const c of completions) {
    const quest = counted.get(c.quest_name);
    if (!quest) continue;
    const s = byParticipant.get(c.participant_id) ?? { points: 0, quests: 0, lastAt: null };
    s.points += questPoints(event, quest);
    s.quests += 1;
    if (!s.lastAt || c.completed_at > s.lastAt) s.lastAt = c.completed_at;
    byParticipant.set(c.participant_id, s);
  }

  let rows: Standing[];
  if (event.format === "teams") {
    rows = teams.map((t) => {
      const members = participants.filter((p) => p.team_id === t.id);
      const scores = members.map((m) => byParticipant.get(m.id)).filter(Boolean) as { points: number; quests: number; lastAt: string | null }[];
      return {
        id: t.id,
        name: t.name,
        color: t.color,
        points: scores.reduce((s, x) => s + x.points, 0),
        quests: scores.reduce((s, x) => s + x.quests, 0),
        lastAt: scores.reduce<string | null>((a, x) => (!a || (x.lastAt && x.lastAt > a) ? x.lastAt : a), null),
        members: members.length,
      };
    });
  } else {
    rows = participants.map((p) => {
      const s = byParticipant.get(p.id);
      return { id: p.id, name: p.rsn, color: null, points: s?.points ?? 0, quests: s?.quests ?? 0, lastAt: s?.lastAt ?? null, members: 1 };
    });
  }
  return rows.sort((a, b) => b.points - a.points || b.quests - a.quests || (a.lastAt && b.lastAt ? a.lastAt.localeCompare(b.lastAt) : a.lastAt ? -1 : b.lastAt ? 1 : a.name.localeCompare(b.name)));
}

export const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  Novice: "#3E7D2A",
  Intermediate: "#2E64A8",
  Experienced: "#B5862A",
  Master: "#B5462E",
  Grandmaster: "#7B4BA8",
  Special: "#5B6770",
};
