// Date presets (shared with the attendance leaderboard and the admin
// activity page) and the weighted draw for the Raffles page's attendance tool.

/** A date as YYYY-MM-DD in local time (for <input type="date">). */
export function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export type RafflePreset = "week" | "lastWeek" | "month";

/**
 * Weeks run Sunday to Saturday. "This week" is the one containing today
 * (the Sunday on or before today to the Saturday after); "last week" is the
 * full week before it. "This month" is the 1st to the last day.
 */
export function presetDates(preset: RafflePreset, today = new Date()): { from: string; to: string } {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (preset === "week" || preset === "lastWeek") {
    const start = new Date(day);
    start.setDate(day.getDate() - day.getDay() - (preset === "lastWeek" ? 7 : 0));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { from: toDateInput(start), to: toDateInput(end) };
  }
  const start = new Date(day.getFullYear(), day.getMonth(), 1);
  const end = new Date(day.getFullYear(), day.getMonth() + 1, 0);
  return { from: toDateInput(start), to: toDateInput(end) };
}

/** The ISO range for two date inputs: start of the first day to the end of the last, local time. */
export function rangeFromDates(from: string, to: string): { start: string; end: string } {
  return { start: new Date(`${from}T00:00:00`).toISOString(), end: new Date(`${to}T23:59:59.999`).toISOString() };
}

/** A uniform random number in [0, 1), from the browser's secure random source when there is one. */
function random(): number {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] / 2 ** 32;
  }
  return Math.random();
}

/**
 * Draws `count` different winners. Each person has as many entries as
 * their `count` (names in the list); once someone wins, all their entries
 * leave the draw, so nobody wins twice.
 */
export function drawWinners<T extends { name: string; count: number }>(people: T[], count: number, rand: () => number = random): T[] {
  const pool = people.filter((p) => p.count > 0);
  const winners: T[] = [];
  while (winners.length < count && pool.length > 0) {
    const total = pool.reduce((sum, p) => sum + p.count, 0);
    let ticket = Math.floor(rand() * total);
    let index = 0;
    while (ticket >= pool[index].count) {
      ticket -= pool[index].count;
      index++;
    }
    winners.push(pool[index]);
    pool.splice(index, 1);
  }
  return winners;
}
