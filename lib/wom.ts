import { WOMClient, SKILLS, BOSSES, SkillProps, BossProps } from "@wise-old-man/utils";
import { WOM_GROUP_ID, WOM_BASE_URL } from "./constants";

const womClient = new WOMClient({
  apiKey: process.env.WOM_API_KEY,
  userAgent: "Gn0meHome-Website",
});

export interface ClanMember {
  username: string;
  displayName: string;
  type: string;
  build: string;
  role: string;
  exp: number;
  ehp: number;
  ehb: number;
  ttm: number;
  registeredAt: string;
  lastChangedAt: string | null;
}

/** WOM usernames/RSNs vary in spacing/casing (e.g. "gn0me_vlad" vs "Gn0me Vlad") — normalize before matching. */
export function normalizeRsn(s: string): string {
  return s.toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
}

export async function getGroupMembers(): Promise<ClanMember[]> {
  try {
    const result = await womClient.groups.getGroupDetails(WOM_GROUP_ID);
    const memberships = result.memberships ?? [];

    return memberships.map((m) => ({
      username: m.player.username,
      displayName: m.player.displayName,
      type: m.player.type,
      build: m.player.build,
      role: m.role,
      exp: m.player.exp,
      ehp: m.player.ehp,
      ehb: m.player.ehb,
      ttm: m.player.ttm,
      registeredAt: m.player.registeredAt.toString(),
      lastChangedAt: m.player.lastChangedAt?.toString() ?? null,
    }));
  } catch (error) {
    console.error("Failed to fetch group members from WOM:", error);
    return [];
  }
}

export async function getGroupDetails() {
  try {
    return await womClient.groups.getGroupDetails(WOM_GROUP_ID);
  } catch (error) {
    console.error("Failed to fetch group details from WOM:", error);
    return null;
  }
}

export async function getPlayerDetails(username: string) {
  try {
    return await womClient.players.getPlayerDetails(username);
  } catch (error) {
    console.error(`Failed to fetch player ${username} from WOM:`, error);
    return null;
  }
}

export async function getGroupAchievements(limit: number = 20) {
  try {
    return await womClient.groups.getGroupAchievements(WOM_GROUP_ID, { limit });
  } catch (error) {
    console.error("Failed to fetch group achievements from WOM:", error);
    return [];
  }
}

export async function getGroupHiscores(metric: string, limit: number = 10) {
  try {
    return await womClient.groups.getGroupHiscores(WOM_GROUP_ID, metric as never, { limit });
  } catch (error) {
    console.error(`Failed to fetch group hiscores for ${metric}:`, error);
    return [];
  }
}

export async function getGroupCompetitions() {
  try {
    return await womClient.groups.getGroupCompetitions(WOM_GROUP_ID);
  } catch (error) {
    console.error("Failed to fetch group competitions from WOM:", error);
    return [];
  }
}

export interface CompetitionLeader {
  displayName: string;
  gained: number;
}

/** Top N participants by progress gained, for a single competition -- who's currently leading (or won, once it's over). */
export async function getCompetitionLeaders(id: number, limit: number = 3): Promise<CompetitionLeader[]> {
  try {
    const details = await womClient.competitions.getCompetitionDetails(id);
    return [...details.participations]
      .sort((a, b) => b.progress.gained - a.progress.gained)
      .slice(0, limit)
      .map((p) => ({ displayName: p.player.displayName, gained: p.progress.gained }));
  } catch (error) {
    console.error(`Failed to fetch competition ${id} leaders from WOM:`, error);
    return [];
  }
}

export interface GroupGainEntry {
  username: string;
  displayName: string;
  gained: number;
}

/** Per-member gained amount for one metric (e.g. "ehp", "ehb", a skill, or a boss) over a date range. */
export async function getGroupGains(metric: string, startDate: Date, endDate: Date, limit: number = 500): Promise<GroupGainEntry[]> {
  try {
    const result = await womClient.groups.getGroupGains(WOM_GROUP_ID, { metric: metric as never, startDate, endDate }, { limit });
    return result.map((r) => ({
      username: r.player.username,
      displayName: r.player.displayName,
      gained: r.data.gained,
    }));
  } catch (error) {
    console.error(`Failed to fetch group gains for ${metric}:`, error);
    return [];
  }
}

export interface MetricGainTotal {
  metric: string;
  metricType: "skill" | "boss";
  name: string;
  totalGained: number;
}

/**
 * Clan-wide total XP/KC gained for every skill and boss over a date range --
 * "as a whole," not per-member. WOM has no single call that returns every
 * metric at once, so this is ~79 sequential-in-small-batches getGroupGains
 * calls (one per skill/boss), meant to run from a daily cron, not live on a
 * page load. "overall" is skipped since it's just the sum of every skill
 * and would dwarf everything else in a "what's the clan grinding" ranking.
 */
export async function getAllSkillBossGains(startDate: Date, endDate: Date): Promise<MetricGainTotal[]> {
  const metrics: { key: string; type: "skill" | "boss"; name: string }[] = [
    ...SKILLS.filter((s) => s !== "overall").map((s) => ({ key: s, type: "skill" as const, name: SkillProps[s].name })),
    ...BOSSES.map((b) => ({ key: b, type: "boss" as const, name: BossProps[b].name })),
  ];

  const BATCH_SIZE = 8;
  const results: MetricGainTotal[] = [];

  for (let i = 0; i < metrics.length; i += BATCH_SIZE) {
    const batch = metrics.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.all(
      batch.map(async ({ key, type, name }) => {
        const gains = await getGroupGains(key, startDate, endDate);
        const totalGained = gains.reduce((sum, g) => sum + Math.max(0, g.gained), 0);
        return { metric: key, metricType: type, name, totalGained };
      })
    );
    results.push(...batchResults);
  }

  return results;
}

export interface CreateCompetitionResult {
  competition: { id: number };
  verificationCode: string;
}

/**
 * Creates a new WOM competition. Unlike the read-only helpers above, this
 * lets errors propagate instead of swallowing them -- a bad/missing group
 * verification code, invalid RSNs, etc. are real problems the admin needs
 * to see, not something to silently return an empty result for.
 *
 * Calls the REST API directly rather than going through `womClient` --
 * @wise-old-man/utils's `CreateCompetitionPayload` type requires either
 * `participants` or `teams` to always be present, but the actual API also
 * accepts a bare `groupId` (no participants/teams key at all) to auto-fill
 * every group member, per their docs. Passing an empty `participants: []`
 * alongside `groupId` to satisfy the client's type is untested and risks
 * silently creating a competition with zero participants, so this sends
 * exactly the shape their docs describe instead.
 */
export async function createWomCompetition(payload: {
  title: string;
  metric: string;
  startsAt: string;
  endsAt: string;
  groupId?: number;
  groupVerificationCode?: string;
  participants?: string[];
  teams?: { name: string; participants: string[] }[];
}): Promise<CreateCompetitionResult> {
  const res = await fetch(`${WOM_BASE_URL}/competitions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.WOM_API_KEY ?? "",
      "User-Agent": "Gn0meHome-Website",
    },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message ?? `WOM competition creation failed (${res.status})`);
  }
  return data as CreateCompetitionResult;
}

/** Deletes a WOM competition. Requires that competition's own verification code, or its host group's. */
export async function deleteWomCompetition(womId: number, verificationCode: string) {
  return womClient.competitions.deleteCompetition(womId, verificationCode);
}

/**
 * Edits a WOM competition's title/metric/dates, and/or wholesale-replaces
 * its participants or teams list. Unlike `createWomCompetition`, the
 * client's `EditCompetitionPayload` type has no problematic union (no
 * groupId case to work around), so this goes through `womClient` directly.
 */
export async function editWomCompetition(
  womId: number,
  payload: { title?: string; metric?: string; startsAt?: Date; endsAt?: Date; participants?: string[]; teams?: { name: string; participants: string[] }[] },
  verificationCode: string
) {
  return womClient.competitions.editCompetition(womId, payload as never, verificationCode);
}

/** Adds participants to an existing competition (works even if it's group-linked). */
export async function addWomParticipants(womId: number, participants: string[], verificationCode: string) {
  return womClient.competitions.addParticipants(womId, participants, verificationCode);
}

/** Removes participants from an existing competition. */
export async function removeWomParticipants(womId: number, participants: string[], verificationCode: string) {
  return womClient.competitions.removeParticipants(womId, participants, verificationCode);
}

/** Forces WOM to refresh (re-scan hiscores for) any outdated participants -- does not change who's participating. */
export async function updateAllWomParticipants(womId: number, verificationCode: string) {
  return womClient.competitions.updateAll(womId, verificationCode);
}
