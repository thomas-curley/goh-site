/**
 * Simple in-memory rate limiter for API routes.
 * Tracks requests by IP with a sliding window.
 *
 * Per-process only -- see durableRateLimit() below for the shared-state
 * version that actually holds across serverless instances.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const store = new Map<string, { count: number; resetAt: number }>();

// Clean up expired entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of store) {
      if (val.resetAt < now) store.delete(key);
    }
  }, 5 * 60 * 1000);
}

/**
 * Durable counterpart to rateLimit(): the count lives in Postgres (see
 * supabase/migrations/063_rate_limits.sql), so it holds across every
 * serverless instance and cold start -- the in-memory limiter above is
 * per-process and an attacker's requests fan out across instances. Fails
 * OPEN on a database error (logged): a limiter outage shouldn't take the
 * feature down with it, and the in-memory check still applies.
 */
export async function durableRateLimit(
  supabase: SupabaseClient,
  key: string,
  { limit, windowSeconds }: { limit: number; windowSeconds: number }
): Promise<{ allowed: boolean }> {
  const { data, error } = await supabase.rpc("rate_limit_hit", {
    p_key: key,
    p_window_seconds: windowSeconds,
    p_max: limit,
  });
  if (error) {
    console.error("rate_limit_hit failed (failing open):", error.message);
    return { allowed: true };
  }
  return { allowed: data !== false };
}

/**
 * The plugin-facing routes' standard guard: a cheap in-memory check first
 * (stops single-instance hammering with zero I/O), then the durable one
 * (authoritative across instances). `burst` is the short in-memory window,
 * `sustained` the durable one. No IP to key on -> allowed (never blocks a
 * request we can't attribute; the ban list and auth still apply).
 */
export async function layeredRateLimit(
  supabase: SupabaseClient,
  ip: string | null,
  bucket: string,
  {
    burst = { limit: 30, windowMs: 60_000 },
    sustained = { limit: 300, windowSeconds: 600 },
  }: {
    burst?: { limit: number; windowMs: number };
    sustained?: { limit: number; windowSeconds: number };
  } = {}
): Promise<{ allowed: boolean }> {
  if (!ip) return { allowed: true };
  if (!rateLimit(`${bucket}:${ip}`, burst).allowed) return { allowed: false };
  return durableRateLimit(supabase, `${bucket}:${ip}`, sustained);
}

export function rateLimit(
  ip: string,
  { limit = 10, windowMs = 60_000 }: { limit?: number; windowMs?: number } = {}
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const key = ip;
  const entry = store.get(key);

  if (!entry || entry.resetAt < now) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1 };
  }

  entry.count++;
  const remaining = Math.max(0, limit - entry.count);
  return { allowed: entry.count <= limit, remaining };
}
