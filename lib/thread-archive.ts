/**
 * Discord's thread "inactivity" setting: how long a forum post (or thread)
 * goes with no replies before Discord auto-archives it. Discord only
 * accepts these four values (minutes). Kept free of server-only imports so
 * both the admin forms and the API routes can share it.
 */
export const THREAD_AUTO_ARCHIVE_OPTIONS = [
  { minutes: 60, label: "1 hour" },
  { minutes: 1440, label: "24 hours" },
  { minutes: 4320, label: "3 days" },
  { minutes: 10080, label: "1 week" },
] as const;

export type ThreadAutoArchive = (typeof THREAD_AUTO_ARCHIVE_OPTIONS)[number]["minutes"];

/** What Discord applies when a request leaves the setting out. */
export const DEFAULT_THREAD_AUTO_ARCHIVE: ThreadAutoArchive = 4320;

/**
 * Validates a client-supplied value (number or numeric string) against the
 * four Discord accepts. Anything else -> undefined, so a bad value never
 * reaches the Discord API and the caller can fall back to its own default.
 */
export function parseThreadAutoArchive(value: unknown): ThreadAutoArchive | undefined {
  const n = typeof value === "string" ? Number(value) : value;
  return THREAD_AUTO_ARCHIVE_OPTIONS.some((o) => o.minutes === n) ? (n as ThreadAutoArchive) : undefined;
}
