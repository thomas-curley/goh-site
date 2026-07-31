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

/**
 * The canonical list of a poll's grid cells, as absolute UTC ISO instants.
 * `days` and the minute bounds are all interpreted in `referenceTimeZone`
 * (the clan's own zone, since that's what the admin was thinking in when
 * they set the poll up) -- this is the only place zone math happens for
 * the whole feature; everywhere else just displays these fixed instants.
 */
export function slotsForPoll(days: string[], startMinute: number, endMinute: number, slotMinutes: number, referenceTimeZone: string): string[] {
  const slots: string[] = [];
  for (const day of days) {
    for (let minute = startMinute; minute < endMinute; minute += slotMinutes) {
      slots.push(zonedTimeToUtc(day, minute, referenceTimeZone).toISOString());
    }
  }
  return slots;
}

export interface AvailabilityGrid {
  days: { key: string; label: string }[]; // columns, chronological
  times: { minuteOfDay: number; label: string }[]; // rows, chronological
  cellAt: (dayKey: string, minuteOfDay: number) => string | undefined; // -> the ISO instant for that cell, if any
}

/**
 * Re-projects a poll's fixed list of UTC instants (from `slotsForPoll`)
 * into day columns + time-of-day rows for display in an arbitrary zone.
 * The instants themselves never change -- only which calendar day and
 * time-of-day they *appear* to fall on shifts with the viewing zone, same
 * as how any calendar app relabels events when you change your timezone.
 * Shared by both the admin heatmap and the respondent grid so the two
 * always agree on layout.
 */
export function buildGrid(slots: string[], timeZone: string): AvailabilityGrid {
  const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }); // YYYY-MM-DD
  const dayLabelFmt = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" });
  const timeFmt = new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" });
  const minuteFmt = new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", minute: "2-digit", hour12: false });

  const dayKeys = new Map<string, string>(); // key -> label
  const timeKeys = new Map<number, string>(); // minuteOfDay -> label
  const cells = new Map<string, string>(); // `${dayKey}|${minuteOfDay}` -> iso

  for (const iso of slots) {
    const d = new Date(iso);
    const dayKey = dayFmt.format(d);
    if (!dayKeys.has(dayKey)) dayKeys.set(dayKey, dayLabelFmt.format(d));

    const [hh, mm] = minuteFmt.format(d).split(":").map(Number);
    const minuteOfDay = (hh === 24 ? 0 : hh) * 60 + mm;
    if (!timeKeys.has(minuteOfDay)) timeKeys.set(minuteOfDay, timeFmt.format(d));

    cells.set(`${dayKey}|${minuteOfDay}`, iso);
  }

  const days = Array.from(dayKeys.entries()).map(([key, label]) => ({ key, label })).sort((a, b) => a.key.localeCompare(b.key));
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
