import { RANKS } from "./constants";

// All available permissions in the system
export const PERMISSIONS = {
  manage_events: {
    key: "manage_events",
    label: "Manage Events",
    description: "Create, edit, and delete clan events",
  },
  manage_guides: {
    key: "manage_guides",
    label: "Manage Guides",
    description: "Create and edit guide content",
  },
  manage_rsn_links: {
    key: "manage_rsn_links",
    label: "Manage RSN Links",
    description: "Approve/deny RSN reset requests and force-unlink RSNs",
  },
  manage_permissions: {
    key: "manage_permissions",
    label: "Manage Permissions",
    description: "Change role-based permission settings",
  },
  manage_commands: {
    key: "manage_commands",
    label: "Manage Commands",
    description: "Create, edit, and delete custom bot commands",
  },
  view_admin: {
    key: "view_admin",
    label: "View Admin Panel",
    description: "Access the admin dashboard",
  },
} as const;

export type PermissionKey = keyof typeof PERMISSIONS;

// All assignable roles (matching RANKS from constants, using the display keys)
export const ASSIGNABLE_ROLES = RANKS.map((r) => ({
  key: r.key,
  name: r.name,
  order: r.order,
}));

/**
 * Normalize a WOM role name to our internal role key.
 * WOM uses "owner", "summoner", etc. — we map those to "council_member".
 */
const COUNCIL_ALIASES = ["owner", "summoner", "council", "council_member", "summoner_hat", "leader", "administrator"];

export function normalizeRole(womRole: string): string {
  const normalized = womRole.toLowerCase().replace(/ /g, "_");
  if (COUNCIL_ALIASES.includes(normalized)) return "council_member";
  return normalized;
}

/**
 * Check if a role has a specific permission, given the permissions map.
 */
export function hasPermission(
  rolePermissions: { role: string; permission: string; granted: boolean }[],
  userRole: string | null,
  permission: PermissionKey
): boolean {
  if (!userRole) return false;
  const normalizedRole = normalizeRole(userRole);

  const entry = rolePermissions.find(
    (rp) => rp.role === normalizedRole && rp.permission === permission
  );

  return entry?.granted ?? false;
}
