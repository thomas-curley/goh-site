import Link from "next/link";
import { redirect } from "next/navigation";
import { checkPermission } from "@/lib/check-permission";
import type { PermissionKey } from "@/lib/permissions";
import type { Metadata } from "next";
import { AdminSidebar } from "@/components/admin/AdminSidebar";

export const metadata: Metadata = {
  title: "Admin Panel",
  robots: { index: false, follow: false },
};

const ADMIN_NAV: { href: string; label: string; permission: PermissionKey; group?: string }[] = [
  { href: "/admin", label: "Dashboard", permission: "view_admin" },
  { href: "/admin/activity", label: "Player Activity", permission: "view_admin" },
  { href: "/admin/tutorials", label: "Tutorials", permission: "view_admin" },

  { href: "/admin/events", label: "Create Event", permission: "manage_events", group: "Events" },
  { href: "/admin/events/list", label: "Event List", permission: "manage_events", group: "Events" },
  { href: "/admin/event-recap", label: "Event Recap", permission: "manage_events", group: "Events" },
  { href: "/admin/attendance-export", label: "Attendance Export", permission: "manage_events", group: "Events" },
  { href: "/admin/announcements", label: "Announcements", permission: "manage_events", group: "Events" },
  { href: "/admin/ingame-events", label: "In-Game Events", permission: "manage_events", group: "Events" },

  { href: "/admin/polls", label: "Polls", permission: "manage_polls", group: "Engagement" },
  { href: "/admin/surveys", label: "Surveys", permission: "manage_surveys", group: "Engagement" },
  { href: "/admin/feedback", label: "Feedback", permission: "manage_feedback", group: "Engagement" },
  { href: "/admin/wom-competitions", label: "WOM Competitions", permission: "manage_competitions", group: "Engagement" },
  { href: "/admin/availability", label: "Availability Polls", permission: "manage_availability", group: "Engagement" },
  { href: "/admin/loans", label: "Loans", permission: "manage_loans", group: "Engagement" },
  { href: "/admin/payouts", label: "Prize Payouts", permission: "manage_payouts", group: "Engagement" },

  { href: "/admin/bingo", label: "Create Bingo Event", permission: "manage_bingo", group: "Bingo" },
  { href: "/admin/bingo/list", label: "Bingo Event List", permission: "manage_bingo", group: "Bingo" },

  { href: "/admin/templates", label: "Post Templates", permission: "manage_templates", group: "Content" },
  { href: "/admin/guides", label: "Guides", permission: "manage_guides", group: "Content" },
  { href: "/admin/handbook", label: "Staff Handbook", permission: "manage_handbook", group: "Content" },

  { href: "/admin/rsn-links", label: "RSN Links", permission: "manage_rsn_links", group: "Members" },
  { href: "/admin/staff-applications", label: "Staff Applications", permission: "manage_staff_applications", group: "Members" },
  { href: "/admin/gn0mebook", label: "Gn0meBook", permission: "manage_member_profiles", group: "Members" },
  { href: "/admin/gnomie-reviews", label: "Review a Gn0mie", permission: "manage_gnomie_reviews", group: "Members" },

  { href: "/admin/commands", label: "Bot Commands", permission: "manage_commands", group: "System" },
  { href: "/admin/permissions", label: "Permissions", permission: "manage_permissions", group: "System" },
  { href: "/admin/alert-channels", label: "Alert Channels", permission: "manage_settings", group: "System" },
  { href: "/admin/banned-ips", label: "Banned IPs", permission: "manage_banned_ips", group: "System" },
  { href: "/admin/sections", label: "Section Visibility", permission: "manage_sections", group: "System" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { allowed, user } = await checkPermission("view_admin");

  if (!user && allowed) {
    // Supabase not configured — dev mode
    return (
      <div className="min-h-[80vh]">
        <div className="bg-gold/20 border-b border-gold px-4 py-2 text-center text-sm text-bark-brown">
          Admin panel — Supabase not configured. Auth enforcement disabled for development.
        </div>
        <div className="mx-auto px-4 lg:px-8 py-6">
          <AdminSidebar navItems={ADMIN_NAV}>{children}</AdminSidebar>
        </div>
      </div>
    );
  }

  if (!user) {
    redirect("/login?redirect=/admin");
  }

  if (!allowed) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
        <h1 className="font-display text-4xl text-gold-display mb-4">Access Denied</h1>
        <p className="text-bark-brown-light mb-2">
          You don&apos;t have permission to access the admin panel.
        </p>
        <p className="text-sm text-iron-grey">
          {user.clan_rank
            ? `Your rank (${user.clan_rank}) doesn't have "View Admin Panel" permission.`
            : "Link your RSN on the Account page to get your clan rank detected."}
        </p>
        <Link href="/account" className="mt-6 text-gnome-green hover:text-gnome-green-light underline">
          Go to Account Page
        </Link>
      </div>
    );
  }

  // Filter nav to only show items the user has permission for
  const visibleNav = [];
  for (const item of ADMIN_NAV) {
    const { allowed: itemAllowed } = await checkPermission(item.permission);
    if (itemAllowed) visibleNav.push(item);
  }

  return (
    <div className="min-h-[80vh]">
      <div className="bg-gnome-green/10 border-b border-gnome-green/30 px-4 py-2 text-center text-sm text-gnome-green">
        Logged in as <span className="font-semibold">{user.discord_username}</span>
        {user.clan_rank && (
          <span className="text-iron-grey ml-2">
            ({user.clan_rank.replace(/_/g, " ")})
          </span>
        )}
      </div>
      <div className="mx-auto px-4 lg:px-8 py-6">
        <AdminSidebar navItems={visibleNav}>{children}</AdminSidebar>
      </div>
    </div>
  );
}
