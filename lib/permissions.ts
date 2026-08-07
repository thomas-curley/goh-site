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
  manage_templates: {
    key: "manage_templates",
    label: "Manage Post Templates",
    description: "Create and edit Discord post templates and section presets",
  },
  sync_discord_posts: {
    key: "sync_discord_posts",
    label: "Update Posted Discord Messages",
    description: "Push edits to announcements, event posts, signup threads, and event recaps that have already been posted to Discord",
  },
  manage_staff_applications: {
    key: "manage_staff_applications",
    label: "Review Staff Applications",
    description: "Review and decide on member applications for staff roles",
  },
  manage_polls: {
    key: "manage_polls",
    label: "Create & Manage Polls",
    description: "Create Discord polls for clan votes and view results",
  },
  manage_settings: {
    key: "manage_settings",
    label: "Manage Alert Channel Settings",
    description: "Configure which Discord channel each feature posts notifications to",
  },
  manage_surveys: {
    key: "manage_surveys",
    label: "Manage Surveys",
    description: "Create surveys and view responses",
  },
  manage_feedback: {
    key: "manage_feedback",
    label: "Manage Feedback",
    description: "Review and triage submitted feedback",
  },
  manage_competitions: {
    key: "manage_competitions",
    label: "Manage WOM Competitions",
    description: "Create and delete Wise Old Man competitions",
  },
  manage_availability: {
    key: "manage_availability",
    label: "Manage Availability Polls",
    description: "Create scheduling polls and review submitted availability",
  },
  manage_member_profiles: {
    key: "manage_member_profiles",
    label: "Moderate Gn0meBook Profiles",
    description: "Hide member profile pages that need to come down",
  },
  manage_banned_ips: {
    key: "manage_banned_ips",
    label: "Manage Banned IPs",
    description: "Block IP addresses from submitting to public forms like surveys",
  },
  manage_handbook: {
    key: "manage_handbook",
    label: "Manage Staff Handbook",
    description: "Create and edit Staff Handbook pages",
  },
  manage_loans: {
    key: "manage_loans",
    label: "Manage Loan Board",
    description: "View every loan request, force-close disputes, and oversee the clan loan board",
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
