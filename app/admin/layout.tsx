import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase-server";
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

// Ranks that can access the admin panel
// WOM roles that grant admin access — these all display as "Council Member"
const ADMIN_RANKS = ["council_member", "council", "summoner", "summoner_hat", "owner", "leader", "administrator"];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let isAuthorized = false;
  let userName = "";
  let supabaseConfigured = true;

  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      redirect("/login?redirect=/admin");
    }

    // Check if user has admin rank
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("discord_username, clan_rank")
      .eq("id", user.id)
      .single();

    userName = profile?.discord_username ?? "Unknown";

    if (profile?.clan_rank && ADMIN_RANKS.includes(profile.clan_rank.toLowerCase())) {
      isAuthorized = true;
    } else {
      // For development: allow access but show warning
      // In production, you could redirect with: redirect("/account");
      isAuthorized = true; // Remove this line to enforce rank check
    }
  } catch {
    // Supabase not configured — allow access for development
    supabaseConfigured = false;
    isAuthorized = true;
  }

  return (
    <div className="min-h-[80vh]">
      {/* Status Banner */}
      {!supabaseConfigured ? (
        <div className="bg-gold/20 border-b border-gold px-4 py-2 text-center text-sm text-bark-brown">
          Admin panel — Supabase not configured. Auth enforcement disabled for development.
        </div>
      ) : (
        <div className="bg-gnome-green/10 border-b border-gnome-green/30 px-4 py-2 text-center text-sm text-gnome-green">
          Logged in as <span className="font-semibold">{userName}</span>
        </div>
      )}

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
