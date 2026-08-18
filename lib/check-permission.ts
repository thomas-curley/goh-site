import { createSupabaseServerClient } from "./supabase-server";
import { normalizeRole, type PermissionKey } from "./permissions";

/**
 * Server-side permission check. Returns true if the current user's clan rank
 * has the given permission granted in role_permissions.
 */
export async function checkPermission(permission: PermissionKey): Promise<{
  allowed: boolean;
  user: { id: string; clan_rank: string | null; discord_username: string } | null;
}> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return { allowed: false, user: null };

    // Get user's clan rank
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("clan_rank, discord_username")
      .eq("id", user.id)
      .single();

    // No linked/verified clan rank yet -- resolve to "guest" instead of an
    // automatic denial, so an admin can explicitly grant a capability to
    // signed-in-but-unregistered users via the Guest row in role_permissions
    // if they choose to (defaults to false either way until they do).
    const normalizedRole = profile?.clan_rank ? normalizeRole(profile.clan_rank) : "guest";

    // Check permission
    const { data: perm } = await supabase
      .from("role_permissions")
      .select("granted")
      .eq("role", normalizedRole)
      .eq("permission", permission)
      .single();

    return {
      allowed: perm?.granted ?? false,
      user: { id: user.id, clan_rank: profile?.clan_rank ?? null, discord_username: profile?.discord_username ?? "" },
    };
  } catch {
    // Supabase not configured
    return { allowed: true, user: null }; // Allow in dev mode
  }
}
