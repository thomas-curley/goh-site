import type { SupabaseClient } from "@supabase/supabase-js";
import { getGroupMembers } from "@/lib/wom";
import { getRankByName } from "@/lib/constants";
import { normalizeRole } from "@/lib/permissions";
import { linkedRsns, bestMembership } from "@/lib/rank-resolution";
import { SITE_SECTIONS, type SiteSectionKey } from "@/lib/site-sections";

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
    const rsns = await linkedRsns(supabase, userId, profile.rsn);
    const member = bestMembership(members, rsns);
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

/**
 * Resolves a caller to their effective role key for the section-visibility
 * grid: a normalized RANKS key (see lib/permissions.ts's normalizeRole) if
 * they're a linked, verified, current clan member, or "guest" for anyone
 * else -- never logged in, no linked RSN, unverified, or no longer in the
 * clan. Shared so checkClanEligibility and isSectionVisible don't each keep
 * their own copy of the WOM-roster-lookup logic. Exported so a caller that
 * needs to check several sections/permissions at once (e.g.
 * /api/site-sections/visible) can resolve the role a single time instead of
 * once per check -- each resolution costs a WOM API call.
 */
export async function resolveEffectiveRole(supabase: SupabaseClient, userId: string | null): Promise<string> {
  if (!userId) return "guest";

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("rsn, rsn_verified")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.rsn || !profile.rsn_verified) return "guest";

  const members = await getGroupMembers();
  const rsns = await linkedRsns(supabase, userId, profile.rsn);
  const member = bestMembership(members, rsns);
  return member ? normalizeRole(member.role) : "guest";
}

/**
 * Whether a section (see lib/site-sections.ts) is visible to the caller,
 * per the role grid an admin configures at /admin/sections. Absence of a
 * row for their resolved role means visible -- fails open, so registering a
 * new section never silently locks anyone out until an admin explicitly
 * restricts it for that role.
 */
export async function isSectionVisible(supabase: SupabaseClient, key: SiteSectionKey, userId: string | null): Promise<boolean> {
  const role = await resolveEffectiveRole(supabase, userId);
  return isSectionVisibleForRole(supabase, role, key);
}

/** Same check as isSectionVisible, but for a role resolved once up front -- for a caller checking several sections at once (see resolveEffectiveRole's doc comment). */
export async function isSectionVisibleForRole(supabase: SupabaseClient, role: string, key: SiteSectionKey): Promise<boolean> {
  const { data } = await supabase.from("section_visibility").select("visible").eq("role", role).eq("section_key", key).maybeSingle();
  return data?.visible ?? true;
}

/**
 * Every registered section key the given viewer is NOT allowed to see --
 * resolves their role once and checks it against every section, same as
 * /api/site-sections/visible. Shared so the root layout can compute this
 * server-side (for the nav's first paint -- no client-side fetch means no
 * flash of a hidden section rendering before it's hidden a moment later)
 * and the API route can compute the same thing for the client's later
 * freshness re-check, without the two ever answering differently.
 */
export async function getHiddenSectionKeys(supabase: SupabaseClient, userId: string | null): Promise<string[]> {
  const role = await resolveEffectiveRole(supabase, userId);
  const results = await Promise.all(
    SITE_SECTIONS.map(async (section) => ({
      key: section.key,
      visible: await isSectionVisibleForRole(supabase, role, section.key),
    }))
  );
  return results.filter((r) => !r.visible).map((r) => r.key);
}
