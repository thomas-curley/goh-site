import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAlertChannel } from "@/lib/alert-channels";
import { postToDestination } from "@/lib/discord";
import { normalizeRsn } from "@/lib/wom";
import {
  computeStandings,
  eventQuests,
  QUEST_BY_NAME,
  questPoints,
  type QuestCompletion,
  type QuestEvent,
  type QuestParticipant,
  type QuestTeam,
} from "@/lib/quests";

export function questServiceClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export const QUEST_EVENT_COLUMNS =
  "id, name, description, rules, banner_url, starts_at, ends_at, status, format, scoring, difficulty_points, flat_points, quest_names, include_miniquests, last_synced_at, created_at, updated_at";
const PARTICIPANT_COLUMNS = "id, user_id, rsn, team_id, is_captain, has_wikisync, quests_done, baseline_at, last_checked_at, joined_at";

export interface QuestBundle {
  event: QuestEvent;
  teams: QuestTeam[];
  participants: QuestParticipant[];
  completions: QuestCompletion[];
}

export async function loadQuestBundle(supabase: SupabaseClient, eventId: string): Promise<QuestBundle | null> {
  const { data: event } = await supabase.from("quest_events").select(QUEST_EVENT_COLUMNS).eq("id", eventId).maybeSingle();
  if (!event) return null;
  const [{ data: teams }, { data: participants }, { data: completions }] = await Promise.all([
    supabase.from("quest_event_teams").select("id, name, color, sort_order").eq("event_id", eventId).order("sort_order"),
    supabase.from("quest_event_participants").select(PARTICIPANT_COLUMNS).eq("event_id", eventId).order("joined_at"),
    supabase.from("quest_event_completions").select("participant_id, quest_name, source, completed_at").eq("event_id", eventId).order("completed_at"),
  ]);
  return {
    event: event as QuestEvent,
    teams: (teams ?? []) as QuestTeam[],
    participants: (participants ?? []) as QuestParticipant[],
    completions: (completions ?? []) as QuestCompletion[],
  };
}

// ── WikiSync ────────────────────────────────────────────────────────

const WIKISYNC_UA = "GnomeHomeClanSite/1.0 (quest events)";

/**
 * A player's quest states from WikiSync (0 not started, 1 started, 2 done),
 * or null when they have no WikiSync data. Throws on a network or server
 * error so a hiccup isn't mistaken for "no data".
 */
export async function fetchWikiSync(rsn: string): Promise<Record<string, number> | null> {
  const res = await fetch(`https://sync.runescape.wiki/runelite/player/${encodeURIComponent(rsn)}/STANDARD`, {
    headers: { "User-Agent": WIKISYNC_UA },
    cache: "no-store",
  });
  if (res.status === 400 || res.status === 404) return null;
  if (!res.ok) throw new Error(`WikiSync returned ${res.status} for ${rsn}`);
  const data = await res.json().catch(() => null);
  const quests = data?.quests;
  if (!quests || typeof quests !== "object") return null;
  const out: Record<string, number> = {};
  for (const [name, status] of Object.entries(quests)) if (QUEST_BY_NAME.has(name)) out[name] = Number(status);
  return out;
}

export function eventStarted(event: Pick<QuestEvent, "status" | "starts_at">, now = Date.now()): boolean {
  return event.status === "active" && (!event.starts_at || Date.parse(event.starts_at) <= now);
}

export function eventOpen(event: Pick<QuestEvent, "status" | "starts_at" | "ends_at">, now = Date.now()): boolean {
  return eventStarted(event, now) && (!event.ends_at || Date.parse(event.ends_at) > now);
}

async function logActivity(supabase: SupabaseClient, row: { event_id: string; participant_id?: string | null; quest_name?: string | null; kind: string }) {
  await supabase.from("quest_event_activity").insert(row);
}

async function announce(supabase: SupabaseClient, title: string, content: string, images?: string[]) {
  try {
    const channelId = await getAlertChannel(supabase, "quest_events");
    if (channelId) await postToDestination(channelId, title, content, images?.length ? images : undefined);
  } catch (err) {
    console.error("Quest event Discord post failed:", err);
  }
}

/**
 * Records a finished quest for a participant (once), with the activity
 * entry and a Discord post. Returns false if it was already recorded.
 */
export async function recordCompletion(
  supabase: SupabaseClient,
  bundle: QuestBundle,
  participant: QuestParticipant,
  questName: string,
  source: "wikisync" | "proof" | "staff",
  images?: string[]
): Promise<boolean> {
  if (bundle.completions.some((c) => c.participant_id === participant.id && c.quest_name === questName)) return false;
  const completed_at = new Date().toISOString();
  const { error } = await supabase.from("quest_event_completions").insert({ event_id: bundle.event.id, participant_id: participant.id, quest_name: questName, source, completed_at });
  if (error) return false; // unique violation: another sync got there first
  bundle.completions.push({ participant_id: participant.id, quest_name: questName, source, completed_at });
  await logActivity(supabase, { event_id: bundle.event.id, participant_id: participant.id, quest_name: questName, kind: "completed" });

  const quest = QUEST_BY_NAME.get(questName);
  const counted = eventQuests(bundle.event).some((q) => q.name === questName);
  if (quest && counted && bundle.event.status === "active") {
    const pts = questPoints(bundle.event, quest);
    const standings = computeStandings(bundle.event, bundle.participants, bundle.teams, bundle.completions);
    const key = bundle.event.format === "teams" ? participant.team_id : participant.id;
    const rank = standings.findIndex((s) => s.id === key) + 1;
    const row = standings.find((s) => s.id === key);
    const team = bundle.teams.find((t) => t.id === participant.team_id);
    await announce(
      supabase,
      `${participant.rsn}: ${questName}`,
      [
        `📜 **${participant.rsn}**${team ? ` (${team.name})` : ""} completed **${questName}** in **${bundle.event.name}**!`,
        `+${pts} ${pts === 1 ? "point" : "points"}${row ? ` · ${bundle.event.format === "teams" ? team?.name ?? "team" : "now"} ${row.points} points, #${rank}` : ""}`,
      ].join("\n"),
      images
    );
  }
  return true;
}

/**
 * Checks one participant's WikiSync. Before the event starts this just
 * refreshes their starting snapshot; once it has started, every quest that
 * is now done but wasn't in the snapshot counts as finished during the
 * event. A player first seen after the start gets their snapshot then.
 */
export async function syncParticipant(supabase: SupabaseClient, bundle: QuestBundle, participant: QuestParticipant, now = Date.now()): Promise<{ newQuests: string[]; error?: string }> {
  let quests: Record<string, number> | null;
  try {
    quests = await fetchWikiSync(participant.rsn);
  } catch (err) {
    return { newQuests: [], error: err instanceof Error ? err.message : String(err) };
  }
  const checkedAt = new Date(now).toISOString();
  if (!quests) {
    await supabase.from("quest_event_participants").update({ has_wikisync: false, last_checked_at: checkedAt }).eq("id", participant.id);
    Object.assign(participant, { has_wikisync: false, last_checked_at: checkedAt });
    return { newQuests: [] };
  }
  const done = Object.values(quests).filter((s) => s === 2).length;
  const update: Record<string, unknown> = { has_wikisync: true, quests_done: done, last_checked_at: checkedAt };

  const started = eventStarted(bundle.event, now);
  const ended = bundle.event.ends_at ? Date.parse(bundle.event.ends_at) <= now : false;
  const newQuests: string[] = [];
  const { data: row } = await supabase.from("quest_event_participants").select("baseline").eq("id", participant.id).maybeSingle();
  const baseline = row?.baseline as Record<string, number> | null;

  if (!started || !baseline) {
    // Before the start (or first sight after it): this is their starting point.
    update.baseline = quests;
    update.baseline_at = checkedAt;
  } else if (!ended && bundle.event.status === "active") {
    for (const [name, status] of Object.entries(quests)) {
      if (status === 2 && baseline[name] !== 2) newQuests.push(name);
    }
  }
  await supabase.from("quest_event_participants").update(update).eq("id", participant.id);
  Object.assign(participant, { has_wikisync: true, quests_done: done, last_checked_at: checkedAt, ...(update.baseline_at ? { baseline_at: checkedAt } : {}) });
  for (const name of newQuests) await recordCompletion(supabase, bundle, participant, name, "wikisync");
  return { newQuests };
}

/** Checks every participant of an event, a few at a time. Skips if it ran within `minAgeMinutes`. */
export async function syncQuestEvent(supabase: SupabaseClient, eventId: string, { minAgeMinutes = 0 } = {}): Promise<{ checked: number; newQuests: number; skipped?: boolean; errors: string[] }> {
  const bundle = await loadQuestBundle(supabase, eventId);
  if (!bundle || bundle.event.status === "draft" || bundle.event.status === "completed") return { checked: 0, newQuests: 0, skipped: true, errors: [] };
  const last = bundle.event.last_synced_at ? Date.parse(bundle.event.last_synced_at) : 0;
  if (minAgeMinutes > 0 && Date.now() - last < minAgeMinutes * 60_000) return { checked: 0, newQuests: 0, skipped: true, errors: [] };
  await supabase.from("quest_events").update({ last_synced_at: new Date().toISOString() }).eq("id", eventId);

  const errors: string[] = [];
  let newQuests = 0;
  const queue = [...bundle.participants];
  const worker = async () => {
    for (let p = queue.shift(); p; p = queue.shift()) {
      const r = await syncParticipant(supabase, bundle, p);
      newQuests += r.newQuests.length;
      if (r.error) errors.push(r.error);
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  return { checked: bundle.participants.length, newQuests, errors };
}

// ── Viewer ──────────────────────────────────────────────────────────

export interface QuestViewer {
  userId: string | null;
  rsns: string[];
  mainRsn: string | null;
  verified: boolean;
  isStaff: boolean;
}

export async function getQuestViewer(supabase: SupabaseClient): Promise<QuestViewer> {
  const none: QuestViewer = { userId: null, rsns: [], mainRsn: null, verified: false, isStaff: false };
  try {
    const { createSupabaseServerClient } = await import("@/lib/supabase-server");
    const { checkPermission } = await import("@/lib/check-permission");
    const auth = await createSupabaseServerClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return none;
    const [{ data: profile }, { data: alts }, perm] = await Promise.all([
      supabase.from("user_profiles").select("rsn, rsn_verified").eq("id", user.id).maybeSingle(),
      supabase.from("user_alt_rsns").select("rsn").eq("user_id", user.id),
      checkPermission("manage_quests"),
    ]);
    const rsns = [profile?.rsn, ...(alts ?? []).map((a) => a.rsn)].filter((r): r is string => !!r);
    return { userId: user.id, rsns, mainRsn: profile?.rsn ?? null, verified: !!profile?.rsn_verified, isStaff: perm.allowed };
  } catch {
    return none;
  }
}

/** The participant rows that belong to the viewer (their main RSN or any alt). */
export function viewerParticipants(participants: QuestParticipant[], viewer: Pick<QuestViewer, "userId" | "rsns">): QuestParticipant[] {
  const wanted = new Set(viewer.rsns.map(normalizeRsn));
  return participants.filter((p) => (viewer.userId && p.user_id === viewer.userId) || wanted.has(normalizeRsn(p.rsn)));
}

export async function logQuestActivity(supabase: SupabaseClient, row: { event_id: string; participant_id?: string | null; quest_name?: string | null; kind: string }) {
  await logActivity(supabase, row);
}

/** Posts the final standings when an event finishes. */
export async function announceQuestResults(supabase: SupabaseClient, bundle: QuestBundle) {
  const standings = computeStandings(bundle.event, bundle.participants, bundle.teams, bundle.completions).filter((s) => s.points > 0);
  const medals = ["🥇", "🥈", "🥉"];
  const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const lines = standings.slice(0, 10).map((s, i) => `${medals[i] ?? `${i + 1}.`} **${s.name}** with ${s.points} points (${s.quests} ${s.quests === 1 ? "quest" : "quests"})`);
  await announce(
    supabase,
    `${bundle.event.name}: results`,
    [`🏁 **${bundle.event.name}** is over${standings[0] ? `, and **${standings[0].name}** wins!` : "!"}`, "", ...lines, "", site ? `Full results: ${site}/quests/${bundle.event.id}` : ""].join("\n").trim()
  );
}
