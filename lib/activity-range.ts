/**
 * Shared "This Week / This Month / All Time / custom" date-range resolver
 * for the Player Activity dashboard's API routes -- extracted so every
 * activity-related endpoint agrees on identical period semantics.
 */
export function resolveRange(searchParams: URLSearchParams): { start: Date; end: Date } {
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");
  const period = searchParams.get("period") ?? "month";

  const end = endParam ? new Date(endParam) : new Date();

  if (startParam) return { start: new Date(startParam), end };

  const start = new Date(end);
  if (period === "week") {
    start.setDate(start.getDate() - 7);
  } else if (period === "all") {
    // WOM has no canned "all time" gains period — go back far enough that
    // it's effectively the group's whole history.
    start.setFullYear(start.getFullYear() - 10);
  } else {
    start.setMonth(start.getMonth() - 1);
  }
  return { start, end };
}
