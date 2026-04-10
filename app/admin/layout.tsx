import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Panel",
  robots: { index: false, follow: false },
};

const ADMIN_NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/guides", label: "Guides" },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // TODO: Add Supabase Auth check here — redirect to login if not Council/Summoner Hat
  // For now, layout is accessible but shows a warning banner

  return (
    <div className="min-h-[80vh]">
      {/* Auth Warning Banner */}
      <div className="bg-gold/20 border-b border-gold px-4 py-2 text-center text-sm text-bark-brown">
        Admin panel — Discord OAuth login required when Supabase is connected.
        Currently accessible for development.
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Sidebar */}
          <aside className="md:w-56 shrink-0">
            <h2 className="font-display text-xl text-gnome-green mb-4">
              Admin Panel
            </h2>
            <nav className="space-y-1">
              {ADMIN_NAV.map((item) => (
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

          {/* Content */}
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
