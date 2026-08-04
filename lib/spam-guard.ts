import { rateLimit } from "@/lib/rate-limit";

/**
 * Zero-friction anti-spam helpers for the public forms that don't require
 * signing in (Surveys/Availability when set to anonymous, and Feedback,
 * which is always sign-in-free). Reactive IP banning (lib/ip-ban.ts)
 * catches a spammer after the fact; these are meant to stop casual/bot
 * spam before it piles up, without adding a CAPTCHA or any external
 * service. All three checks are opt-in per caller and degrade gracefully
 * (missing data never itself counts as spam) so they never risk rejecting
 * a genuine slow/odd submission outright -- only unambiguous bot signals.
 */

// A field name generic bots commonly autofill without a human ever seeing
// it -- real users never see or fill this (hidden via CSS on the form).
export const HONEYPOT_FIELD = "website";

/** True if the honeypot field was filled in -- almost certainly a bot. */
export function isHoneypotTripped(body: Record<string, unknown>): boolean {
  const value = body[HONEYPOT_FIELD];
  return typeof value === "string" && value.trim() !== "";
}

/**
 * True if the form was submitted implausibly soon after it was rendered
 * (a human can't read + fill even a short form in under ~2s; bots that
 * script a POST directly often do). `renderedAt` is a client-supplied
 * timestamp (ms since epoch) captured on mount -- if it's missing or
 * malformed, this never flags spam, it just skips the check.
 */
export function submittedTooFast(renderedAt: unknown, minMs = 2500): boolean {
  const ms = Number(renderedAt);
  if (!Number.isFinite(ms) || ms <= 0) return false;
  return Date.now() - ms < minMs;
}

/**
 * Per-IP submission throttle, namespaced separately from other uses of
 * lib/rate-limit.ts (e.g. the AI reformat/banner tools) so they don't
 * share a quota. Returns `allowed: true` when there's no IP to key on --
 * this only tightens the honeypot/timing checks, never replaces them.
 */
export function checkSubmissionRateLimit(ip: string | null, opts?: { limit?: number; windowMs?: number }): { allowed: boolean } {
  if (!ip) return { allowed: true };
  return rateLimit(`submit:${ip}`, opts ?? { limit: 5, windowMs: 10 * 60_000 });
}
