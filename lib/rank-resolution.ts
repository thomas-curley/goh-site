import type { SupabaseClient } from "@supabase/supabase-js";
import { getRankOrder } from "./constants";
import { normalizeRsn } from "./wom";

/** The account's main RSN (if any) plus every linked alt, main first. */
export async function linkedRsns(supabase: SupabaseClient, userId: string, mainRsn: string | null): Promise<string[]> {
  const rsns = mainRsn ? [mainRsn] : [];
  const { data: alts } = await supabase.from("user_alt_rsns").select("rsn").eq("user_id", userId);
  for (const alt of alts ?? []) {
    if (alt.rsn) rsns.push(alt.rsn);
  }
  return rsns;
}

/**
 * Best WOM group membership (highest clan rank) across a list of RSNs --
 * used where the caller already has a live group roster (checkClanEligibility,
 * resolveEffectiveRole), so it can check every linked RSN against it instead
 * of just the main one.
 */
export function bestMembership<T extends { displayName: string; role: string }>(members: T[], rsns: string[]): T | null {
  let best: T | null = null;
  let bestOrder = -1;
  for (const rsn of rsns) {
    const normalized = normalizeRsn(rsn);
    const member = members.find((m) => normalizeRsn(m.displayName) === normalized);
    if (member) {
      const order = getRankOrder(member.role);
      if (order > bestOrder) {
        best = member;
        bestOrder = order;
      }
    }
  }
  return best;
}
