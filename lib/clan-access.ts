import type { SupabaseClient } from "@supabase/supabase-js";
import { getGroupMembers } from "@/lib/wom";
import { getRankByName } from "@/lib/constants";

export type AccessLevel = "anonymous" | "verified_player" | "clan_member" | "staff";

export const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  anonymous: "Anonymous (default)",
  verified_player: "Verified Player (RSN linked)",
  clan_member: "Clan Member Only",
  staff: "Staff Only (Oak and above)",
};

export interface EligibilityResult {
  eligible: boolean;
  reason?: string;
  verifiedName?: string;
  discordId?: string;
}

/** WOM display names and stored RSNs vary in spacing/casing -- normalize before matching. */
function normalizeRsn(s: string): string {
  return s.toLowerCase().replace(/[-_]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Whether the given (already-authenticated-or-not) user is allowed to access
 * something gated by one of the access levels (surveys, availability
 * polls, ...). Shared by each feature's GET route (a pre-check so the page
 * can show a gate screen before anyone fills anything out) and its response
 * POST route (the real enforcement -- never trust the client's earlier GET
 * check alone). `userId` is the caller's own already-resolved
 * `auth.getUser()` id, or null if signed out. `context` is only used to
 * phrase the rejection reason naturally (e.g. "this survey", "this
 * availability poll").
 */
export async function checkClanEligibility(
  supabase: SupabaseClient,
  accessLevel: AccessLevel,
  userId: string | null,
  context: string = "this"
): Promise<EligibilityResult> {
  if (accessLevel === "anonymous") return { eligible: true };

  if (!userId) {
    return { eligible: false, reason: `You must be signed in to access ${context}.` };
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("discord_id, rsn, rsn_verified")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.rsn || !profile.rsn_verified) {
    return { eligible: false, reason: "Link and verify your RSN on your Account page first." };
  }

  if (accessLevel === "clan_member" || accessLevel === "staff") {
    const members = await getGroupMembers();
    const normalized = normalizeRsn(profile.rsn);
    const member = members.find((m) => normalizeRsn(m.displayName) === normalized);
    if (!member) {
      return { eligible: false, reason: `You must be a current clan member to access ${context}.` };
    }

    if (accessLevel === "staff") {
      const rank = getRankByName(member.role);
      const oakOrder = getRankByName("oak")?.order ?? 1;
      if (!rank || rank.order < oakOrder) {
        return { eligible: false, reason: `You must be a member of Staff to access ${context}.` };
      }
    }
  }

  return { eligible: true, verifiedName: profile.rsn, discordId: profile.discord_id };
}
