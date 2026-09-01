// Shared translation logic between a site `events` row and the values OSRS's
// in-game "Clan Home: Events" creation form expects. Used by the admin
// in-game-events page (client) and the plugin's ingame-events API route
// (server) -- kept in one place so the two never quietly drift apart.

export const OSRS_TYPES = ["Bossing", "Skilling", "PvP", "Social"] as const;
export const OSRS_SUBTYPES = ["None", "Mass", "Wilderness", "Risky", "Serious", "Chill", "Meta", "Competition", "Rewards", "Bingo"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface TranslatableEvent {
  event_type: string;
  start_time: string;
  end_time: string | null;
  osrs_type: string | null;
  osrs_subtype: string | null;
  osrs_activity: string | null;
  osrs_join_rank: string | null;
  osrs_duration_days: number | null;
}

export interface Translation {
  osrsType: string;
  osrsSubtype: string;
  osrsActivity: string;
  osrsJoinRank: string;
  osrsDurationDays: number;
  dateStr: string;
  timeStr: string;
}

export function formatUtcDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

export function formatUtcTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

export function defaultOsrsType(eventType: string): string {
  if (eventType === "pvm") return "Bossing";
  if (eventType === "skilling") return "Skilling";
  return "Social";
}

export function defaultDurationDays(ev: TranslatableEvent): number {
  if (!ev.end_time) return 1;
  const ms = new Date(ev.end_time).getTime() - new Date(ev.start_time).getTime();
  return Math.max(1, Math.round(ms / 86400000));
}

/** The full translated form, falling back to computed defaults for anything staff hasn't filled in yet. */
export function translateEvent(ev: TranslatableEvent): Translation {
  return {
    osrsType: ev.osrs_type ?? defaultOsrsType(ev.event_type),
    osrsSubtype: ev.osrs_subtype ?? "None",
    osrsActivity: ev.osrs_activity ?? "",
    osrsJoinRank: ev.osrs_join_rank ?? "",
    osrsDurationDays: ev.osrs_duration_days ?? defaultDurationDays(ev),
    dateStr: formatUtcDate(ev.start_time),
    timeStr: formatUtcTime(ev.start_time),
  };
}
