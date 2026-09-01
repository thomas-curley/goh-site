import type { SupabaseClient } from "@supabase/supabase-js";
import { getGroupMembers, normalizeRsn, findRenamedTo } from "./wom";

/**
 * Called at login: if the account's linked main RSN and/or any alt no
 * longer matches anyone in the live group roster, checks whether that name
 * was renamed (an approved WOM name change) and, if the new name IS
 * currently in the roster, updates the linked RSN to match. Without this, a
 * member who renames in-game silently reads as having left the clan --
 * losing their rank and every permission derived from it -- until they
 * notice and manually re-link.
 *
 * Deliberately conservative: only ever applies a rename when the *new* name
 * is confirmed to be a current roster member, so this can't be tricked into
 * linking an unrelated name, and someone who genuinely left the clan (no
 * matching rename, or the renamed-to name isn't in the roster either) is
 * correctly left alone -- resolveEffectiveRole's normal "not found" handling
 * still applies to them.
 *
 * Best-effort: a WOM hiccup here never blocks login, and a failed update
 * (e.g. the new name collides with something else already linked) is
 * skipped rather than surfaced -- this is an opportunistic fix-up, not a
 * hard requirement of signing in.
 */
export async function reconcileRenamedRsns(supabase: SupabaseClient, userId: string): Promise<void> {
  try {
    const members = await getGroupMembers();
    if (members.length === 0) return;

    const roster = new Map(members.map((m) => [normalizeRsn(m.displayName), m]));

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("rsn, rsn_verified")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.rsn && profile.rsn_verified && !roster.has(normalizeRsn(profile.rsn))) {
      await reconcileOne(roster, profile.rsn, async (newName, newRole) => {
        await supabase
          .from("user_profiles")
          .update({ rsn: newName, clan_rank: newRole, updated_at: new Date().toISOString() })
          .eq("id", userId);
      });
    }

    const { data: alts } = await supabase.from("user_alt_rsns").select("id, rsn").eq("user_id", userId);
    for (const alt of alts ?? []) {
      if (roster.has(normalizeRsn(alt.rsn))) continue;
      await reconcileOne(roster, alt.rsn, async (newName, newRole) => {
        await supabase.from("user_alt_rsns").update({ rsn: newName, clan_rank: newRole }).eq("id", alt.id);
      });
    }
  } catch {
    // Best-effort -- never block login over this.
  }
}

async function reconcileOne(
  roster: Map<string, { role: string }>,
  staleRsn: string,
  apply: (newName: string, newRole: string) => Promise<void>
): Promise<void> {
  const renamedTo = await findRenamedTo(staleRsn);
  if (!renamedTo) return;

  const newMember = roster.get(normalizeRsn(renamedTo));
  if (!newMember || normalizeRsn(renamedTo) === normalizeRsn(staleRsn)) return;

  await apply(renamedTo, newMember.role);
}
