import { createSupabaseServerClient } from "./supabase-server";
import { resolveEffectiveRole } from "./clan-access";
import type { PermissionKey } from "./permissions";

/**
 * Server-side permission check. Returns true if the current user's clan rank
 * has the given permission granted in role_permissions.
 *
 * Resolves the caller's role live via resolveEffectiveRole (WOM group
 * membership, cached in-memory for 30s -- see lib/wom.ts) rather than
 * reading the user_profiles.clan_rank column, which was only ever set once
 * at RSN-link time and went stale the moment someone's actual clan rank
 * changed. No linked/verified RSN at all resolves to "guest" instead of an
 * automatic denial, so an admin can explicitly grant a capability to
 * signed-in-but-unregistered users via the Guest row in role_permissions if
 * they choose to (defaults to false either way until they do).
 */
export async function checkPermission(permission: PermissionKey): Promise<{
  allowed: boolean;
  user: { id: string; clan_rank: string | null; discord_username: string } | null;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { allowed: false, user: null };

    const { data: profile } = await supabase
      .from("user_profiles")
      .select("discord_username")
      .eq("id", user.id)
      .single();

    const role = await resolveEffectiveRole(supabase, user.id);

    const { data: perm } = await supabase
      .from("role_permissions")
      .select("granted")
      .eq("role", role)
      .eq("permission", permission)
      .single();

    return {
      allowed: perm?.granted ?? false,
      user: { id: user.id, clan_rank: role, discord_username: profile?.discord_username ?? "" },
    };
  } catch {
    // Supabase not configured
    return { allowed: true, user: null }; // Allow in dev mode
  }
}
