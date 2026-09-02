import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveEffectiveRole } from "./clan-access";
import { getRequestIp, isIpBanned } from "./ip-ban";
import { layeredRateLimit, durableRateLimit } from "./rate-limit";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export interface PluginTokenIdentity {
  userId: string;
  discordId: string;
  discordUsername: string;
  rsn: string | null;
  rsnVerified: boolean;
  clanRank: string | null;
}

/**
 * Verifies a RuneLite plugin's "Authorization: Bearer gohpat_..." token.
 * Unlike DISCORD_WEBHOOK_SECRET's inline checks elsewhere in this codebase,
 * this never fails open -- any missing/malformed/unknown/revoked token
 * returns null, full stop.
 */
export async function verifyPluginToken(request: NextRequest): Promise<PluginTokenIdentity | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice("Bearer ".length).trim();
  if (!token) return null;

  const supabase = getServiceClient();
  if (!supabase) return null;

  // Every authenticated plugin route funnels through here, so this is the
  // one place to apply the ban list and a per-IP ceiling to all of them
  // at once. The ceiling is generous for a real client (a poll every few
  // minutes plus occasional actions) and only bites on hammering. Tokens
  // are 256-bit, so guessing is not a realistic path -- but each guess
  // still costs a DB lookup, and failures get their own tighter budget.
  const ip = getRequestIp(request);
  if (await isIpBanned(supabase, ip)) return null;
  const overall = await layeredRateLimit(supabase, ip, "plugin-api", {
    burst: { limit: 120, windowMs: 60_000 },
    sustained: { limit: 1000, windowSeconds: 600 },
  });
  if (!overall.allowed) return null;

  const tokenHash = createHash("sha256").update(token).digest("hex");

  const { data: key } = await supabase
    .from("api_keys")
    .select("id, user_id, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!key || key.revoked_at) {
    // Invalid-token attempts are counted separately (visible in
    // rate_limits as plugin-auth-fail:<ip>) so a guessing source stands out
    // in the data even though the overall ceiling above already bounds it.
    // Only failures touch this counter -- a valid client must never be
    // penalised for someone else's noise.
    if (ip) await durableRateLimit(supabase, `plugin-auth-fail:${ip}`, { limit: 30, windowSeconds: 600 });
    return null;
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("discord_id, discord_username, rsn, rsn_verified")
    .eq("id", key.user_id)
    .maybeSingle();

  if (!profile?.discord_id) return null;

  // Fire-and-forget -- a failed last_used_at update shouldn't block the request.
  supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id).then(
    () => {},
    () => {}
  );

  // Live, not the old cached user_profiles.clan_rank column (which only
  // ever updated at RSN-link time and went stale the moment someone's
  // actual clan rank changed) -- see lib/clan-access.ts's resolveEffectiveRole.
  const clanRank = await resolveEffectiveRole(supabase, key.user_id);

  return {
    userId: key.user_id,
    discordId: profile.discord_id,
    discordUsername: profile.discord_username,
    rsn: profile.rsn,
    rsnVerified: profile.rsn_verified,
    clanRank,
  };
}
