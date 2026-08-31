import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export interface PluginTokenIdentity {
  userId: string;
  discordId: string;
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

  const tokenHash = createHash("sha256").update(token).digest("hex");

  const { data: key } = await supabase
    .from("api_keys")
    .select("id, user_id, revoked_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!key || key.revoked_at) return null;

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("discord_id, rsn, rsn_verified, clan_rank")
    .eq("id", key.user_id)
    .maybeSingle();

  if (!profile?.discord_id) return null;

  // Fire-and-forget -- a failed last_used_at update shouldn't block the request.
  supabase.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id).then(
    () => {},
    () => {}
  );

  return {
    userId: key.user_id,
    discordId: profile.discord_id,
    rsn: profile.rsn,
    rsnVerified: profile.rsn_verified,
    clanRank: profile.clan_rank,
  };
}
