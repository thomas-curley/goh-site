import Link from "next/link";
import { redirect } from "next/navigation";
import { checkPermission } from "@/lib/check-permission";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Panel",
  robots: { index: false, follow: false },
};

const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard", permission: "view_admin" as const },
  { href: "/admin/events", label: "Create Event", permission: "manage_events" as const },
  { href: "/admin/events/list", label: "Event List", permission: "manage_events" as const },
  { href: "/admin/event-recap", label: "Event Recap", permission: "manage_events" as const },
  { href: "/admin/announcements", label: "Announcements", permission: "manage_events" as const },
  { href: "/admin/rsn-links", label: "RSN Links", permission: "manage_rsn_links" as const },
  { href: "/admin/commands", label: "Bot Commands", permission: "manage_commands" as const },
  { href: "/admin/permissions", label: "Permissions", permission: "manage_permissions" as const },
  { href: "/admin/guides", label: "Guides", permission: "manage_guides" as const },
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
        <AdminShell navItems={ADMIN_NAV}>{children}</AdminShell>
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
      <AdminShell navItems={visibleNav}>{children}</AdminShell>
    </div>
  );
}

function AdminShell({
  children,
  navItems,
}: {
  children: React.ReactNode;
  navItems: { href: string; label: string }[];
}) {
  return (
    <div className="mx-auto px-4 lg:px-8 py-6">
      <div className="flex flex-col md:flex-row gap-8">
        <aside className="md:w-48 shrink-0">
          <h2 className="font-display text-xl text-gnome-green mb-4">
            Admin Panel
          </h2>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block px-3 py-2 rounded-md text-sm text-bark-brown hover:bg-parchment-dark hover:text-gnome-green transition-colors"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
