import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest } from "next/server";

/**
 * Best-effort real client IP behind Vercel's edge proxy. `x-forwarded-for`
 * can carry a comma-separated proxy chain -- the first entry is the
 * original client. Matches the header this codebase already reads for
 * rate-limiting (lib/rate-limit.ts, app/api/content/reformat/route.ts).
 */
export function getRequestIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip");
}

/** Whether an IP is on the ban list. Never trust this if `ip` is null -- always false, not banned. */
export async function isIpBanned(supabase: SupabaseClient, ip: string | null): Promise<boolean> {
  if (!ip) return false;
  const { data } = await supabase.from("banned_ips").select("id").eq("ip_address", ip).maybeSingle();
  return !!data;
}
