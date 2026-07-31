// NOTE: deliberately doesn't import/re-export anything from lib/clan-access
// or lib/wom here. This file's functions are pure date/time math with zero
// server dependencies, so both the admin heatmap and the respondent grid
// pages can safely import it client-side without dragging the WOM SDK (and
// its server-only WOM_API_KEY module-scope read) into the browser bundle.
// Import AccessLevel/ACCESS_LEVEL_LABELS/checkClanEligibility directly from
// "@/lib/clan-access" wherever needed instead.

/**
 * Converts a wall-clock day + minutes-from-midnight, interpreted in an
 * arbitrary IANA zone, into the absolute UTC instant it represents.
 * Native `Date` has no constructor for "this wall time, in this zone" --
 * only for local-system-time or UTC -- so this uses the standard
 * workaround: build a naive guess by treating the wall time as if it were
 * already UTC, then ask `Intl.DateTimeFormat` what that guessed instant
 * actually displays as inside the target zone. The difference between the
 * guess and that readback is the zone's offset *on that specific date*
 * (so DST is handled correctly), which corrects the guess into the real
 * answer.
 */
export function zonedTimeToUtc(dateStr: string, minutesFromMidnight: number, timeZone: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  const hour = Math.floor(minutesFromMidnight / 60);
  const minute = minutesFromMidnight % 60;

  const naiveGuess = new Date(Date.UTC(year, month - 1, day, hour, minute));

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(naiveGuess);

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  // Intl can format midnight as "24" in some environments -- normalize to 0.
  const readHour = get("hour") === 24 ? 0 : get("hour");
  const readAsIfUtc = Date.UTC(get("year"), get("month") - 1, get("day"), readHour, get("minute"), get("second"));

  const driftMs = naiveGuess.getTime() - readAsIfUtc;
  return new Date(naiveGuess.getTime() + driftMs);
}

export const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

export const WEEKDAY_LABELS: Record<string, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday",
  friday: "Friday", saturday: "Saturday", sunday: "Sunday",
};

/** Today's calendar date + weekday, as seen in a given zone. */
function todayInZone(timeZone: string): { dateStr: string; weekdayIndex: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const dateStr = `${get("year")}-${get("month")}-${get("day")}`;
  const weekdayIndex = WEEKDAYS.findIndex((w) => w.startsWith(get("weekday").toLowerCase()));
  return { dateStr, weekdayIndex };
}

/**
 * The next calendar date matching `weekday` (today counts, if it already
 * matches), as a YYYY-MM-DD string in `referenceTimeZone`. Recomputed fresh
 * every call rather than ever being persisted -- that's what keeps a
 * "weekly" poll's displayed times DST-correct no matter how long it stays
 * open, the same way a real recurring calendar event re-anchors itself.
 */
function nextOccurrence(weekday: string, referenceTimeZone: string): string {
  const { dateStr, weekdayIndex } = todayInZone(referenceTimeZone);
  const targetIndex = WEEKDAYS.indexOf(weekday);
  const diffDays = (targetIndex - weekdayIndex + 7) % 7;
  if (diffDays === 0) return dateStr;

  const [y, m, d] = dateStr.split("-").map(Number);
  // Pure calendar-date arithmetic (not wall-clock/DST-sensitive), so plain
  // UTC math is fine here -- this never represents an actual instant.
  const anchor = new Date(Date.UTC(y, m - 1, d + diffDays));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${anchor.getUTCFullYear()}-${pad(anchor.getUTCMonth() + 1)}-${pad(anchor.getUTCDate())}`;
}

/**
 * One grid cell. `id` is the stable identity used for storage, aggregation,
 * and click-to-toggle -- for a "dates" poll it's just the slot's own ISO
 * instant, but for a "weekly" poll it's an abstract `${weekday}:${minute}`
 * key so that responses submitted in different real weeks still all land
 * on the same logical bucket. `iso` is always a real, currently-valid UTC
 * instant, used only to compute display labels (day/time) for a viewer's
 * chosen timezone -- never used for identity/aggregation.
 */
export interface SlotEntry {
  id: string;
  iso: string;
}

/**
 * A "dates" poll's grid cells. `days` and the minute bounds are all
 * interpreted in `referenceTimeZone` (the clan's own zone, since that's
 * what the admin was thinking in when they set the poll up).
 */
export function slotsForPoll(days: string[], startMinute: number, endMinute: number, slotMinutes: number, referenceTimeZone: string): SlotEntry[] {
  const entries: SlotEntry[] = [];
  for (const day of days) {
    for (let minute = startMinute; minute < endMinute; minute += slotMinutes) {
      const iso = zonedTimeToUtc(day, minute, referenceTimeZone).toISOString();
      entries.push({ id: iso, iso });
    }
  }
  return entries;
}

/**
 * A "weekly" (recurring, no specific date) poll's grid cells. Each
 * selected weekday gets a freshly-computed anchor date (the next/current
 * real occurrence of that weekday) purely so its slots have a real,
 * DST-correct instant to display -- the `id` on each entry is the abstract
 * weekday+minute key, not tied to that anchor date, so aggregation stays
 * stable across however many real weeks the poll stays open for.
 */
export function slotsForWeeklyPoll(weekdays: string[], startMinute: number, endMinute: number, slotMinutes: number, referenceTimeZone: string): SlotEntry[] {
  const entries: SlotEntry[] = [];
  for (const weekday of weekdays) {
    const anchorDate = nextOccurrence(weekday, referenceTimeZone);
    for (let minute = startMinute; minute < endMinute; minute += slotMinutes) {
      const iso = zonedTimeToUtc(anchorDate, minute, referenceTimeZone).toISOString();
      entries.push({ id: `${weekday}:${minute}`, iso });
    }
  }
  return entries;
}

export interface AvailabilityPollLike {
  mode: "dates" | "weekly";
  days: string[] | null;
  weekdays: string[] | null;
  start_minute: number;
  end_minute: number;
  slot_minutes: number;
}

/** Dispatches to slotsForPoll or slotsForWeeklyPoll based on the poll's mode. */
export function slotsForAvailabilityPoll(poll: AvailabilityPollLike, referenceTimeZone: string): SlotEntry[] {
  if (poll.mode === "weekly") {
    return slotsForWeeklyPoll(poll.weekdays ?? [], poll.start_minute, poll.end_minute, poll.slot_minutes, referenceTimeZone);
  }
  return slotsForPoll(poll.days ?? [], poll.start_minute, poll.end_minute, poll.slot_minutes, referenceTimeZone);
}

export interface AvailabilityGrid {
  days: { key: string; label: string }[]; // columns, chronological (or Monday-first for weekly polls)
  times: { minuteOfDay: number; label: string }[]; // rows, chronological
  cellAt: (dayKey: string, minuteOfDay: number) => string | undefined; // -> the slot id for that cell, if any
}

const WEEKDAY_SHORT_TO_INDEX: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };

/**
 * Re-projects a poll's grid cells into day columns + time-of-day rows for
 * display in an arbitrary zone. For "dates" polls, columns are ordered
 * chronologically by real calendar date; for "weekly" polls (`weekdayOnly`)
 * columns are always ordered Monday-first regardless of which real dates
 * the anchor instants happened to land on, and each column is labeled with
 * just the weekday name (still correctly shifted for the viewer's zone --
 * e.g. a Monday-11pm-Eastern slot can legitimately show as Tuesday for a
 * viewer far enough east). Shared by both the admin heatmap and the
 * respondent grid so the two always agree on layout.
 */
export function buildGrid(entries: SlotEntry[], timeZone: string, options?: { weekdayOnly?: boolean }): AvailabilityGrid {
  const weekdayOnly = options?.weekdayOnly ?? false;
  const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }); // YYYY-MM-DD
  const dayLabelFmt = weekdayOnly
    ? new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" })
    : new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" });
  const weekdayShortFmt = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short" });
  const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
  const minuteFmt = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false });

  const dayKeys = new Map<string, { label: string; sortKey: string | number }>();
  const timeKeys = new Map<number, string>();
  const cells = new Map<string, string>();

  for (const entry of entries) {
    const d = new Date(entry.iso);
    const dayKey = dayFmt.format(d);
    if (!dayKeys.has(dayKey)) {
      const sortKey = weekdayOnly ? WEEKDAY_SHORT_TO_INDEX[weekdayShortFmt.format(d)] ?? 0 : dayKey;
      dayKeys.set(dayKey, { label: dayLabelFmt.format(d), sortKey });
    }

    const [hh, mm] = minuteFmt.format(d).split(":").map(Number);
    const minuteOfDay = (hh === 24 ? 0 : hh) * 60 + mm;
    if (!timeKeys.has(minuteOfDay)) timeKeys.set(minuteOfDay, timeFmt.format(d));

    cells.set(`${dayKey}|${minuteOfDay}`, entry.id);
  }

  const days = Array.from(dayKeys.entries())
    .map(([key, { label, sortKey }]) => ({ key, label, sortKey }))
    .sort((a, b) => (a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0))
    .map(({ key, label }) => ({ key, label }));
  const times = Array.from(timeKeys.entries()).map(([minuteOfDay, label]) => ({ minuteOfDay, label })).sort((a, b) => a.minuteOfDay - b.minuteOfDay);

  return {
    days,
    times,
    cellAt: (dayKey: string, minuteOfDay: number) => cells.get(`${dayKey}|${minuteOfDay}`),
  };
}

/**
 * One representative city per distinct UTC offset, instead of the full
 * ~400-entry IANA zone database (which has many zones -- e.g.
 * America/New_York, America/Detroit, America/Indiana/Indianapolis --
 * that share the same practical offset and just exist for historical/
 * regional record-keeping). Ordered west to east. Deliberately keeps a
 * few zones that LOOK similar to a neighbor but aren't (e.g. Phoenix
 * never observes DST, unlike the rest of Mountain time; Newfoundland/
 * Kathmandu/Chatham sit on non-hour offsets) since those are genuinely
 * different timezones, not duplicates.
 */
export const COMMON_TIMEZONES = [
  "Pacific/Midway", "Pacific/Honolulu", "America/Anchorage",
  "America/Los_Angeles", "America/Phoenix", "America/Denver",
  "America/Chicago", "America/New_York", "America/Halifax",
  "America/St_Johns", "America/Sao_Paulo", "Atlantic/Azores",
  "UTC", "Europe/London", "Europe/Paris", "Europe/Athens",
  "Europe/Moscow", "Asia/Dubai", "Asia/Kabul", "Asia/Karachi",
  "Asia/Kolkata", "Asia/Kathmandu", "Asia/Dhaka", "Asia/Yangon",
  "Asia/Bangkok", "Asia/Shanghai", "Asia/Tokyo", "Australia/Darwin",
  "Australia/Sydney", "Pacific/Guadalcanal", "Pacific/Auckland",
  "Pacific/Chatham", "Pacific/Tongatapu", "Pacific/Kiritimati",
];

/** The curated one-city-per-zone list above -- see COMMON_TIMEZONES. */
export function listTimeZones(): string[] {
  return COMMON_TIMEZONES;
}

/** Best-effort guess at the viewer's own timezone, falling back to a given default. */
export function detectTimeZone(fallback: string): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || fallback;
  } catch {
    return fallback;
  }
}
