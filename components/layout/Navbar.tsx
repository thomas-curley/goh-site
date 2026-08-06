"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { CLAN_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { NavDropdown } from "./NavDropdown";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { User } from "@supabase/supabase-js";

type NavItem =
  | { type: "link"; href: string; label: string }
  | { type: "dropdown"; label: string; items: { href: string; label: string }[] };

const NAV_ITEMS: NavItem[] = [
  { type: "link", href: "/", label: "Home" },
  { type: "link", href: "/events", label: "Events" },
  {
    type: "dropdown",
    label: "Members",
    items: [
      { href: "/gn0mebook", label: "Gn0meBook" },
      { href: "/staff-handbook", label: "Staff Handbook" },
      { href: "/members", label: "Member List" },
      { href: "/leaderboard", label: "Leaderboard" },
      { href: "/competitions", label: "Competitions" },
      { href: "/hiscores", label: "Hiscores" },
    ],
  },
  {
    type: "dropdown",
    label: "Guides",
    items: [
      { href: "/guides", label: "Guides" },
      { href: "/tools", label: "Tools" },
    ],
  },
  {
    type: "dropdown",
    label: "Feedback",
    items: [
      { href: "/feedback", label: "Submit Feedback" },
      { href: "/surveys", label: "Surveys" },
      { href: "/availability", label: "Availability" },
    ],
  },
  { type: "link", href: "/about", label: "About" },
];

// Flattened for the mobile menu -- section headers for dropdown groups,
// their items indented directly beneath (no nested accordion; the whole
// mobile menu is already one big collapsible panel).
const MOBILE_NAV_ITEMS: { href: string; label: string; group?: string }[] = NAV_ITEMS.flatMap((item) =>
  item.type === "link"
    ? [{ href: item.href, label: item.label }]
    : item.items.map((sub) => ({ href: sub.href, label: sub.label, group: item.label }))
);

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function checkAuth() {
      try {
        const supabase = createSupabaseBrowserClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (mounted) setUser(user);
      } catch {
        // Supabase not configured
      } finally {
        if (mounted) setAuthLoaded(true);
      }
    }
    checkAuth();
    return () => { mounted = false; };
  }, []);

  // Close any open dropdown on outside click.
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!(e.target as Element).closest?.("[data-nav-dropdown]")) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = async () => {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  return (
    <nav className="bg-bark-brown border-b-2 border-bark-brown-light shadow-lg sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo / Clan Name */}
          <Link href="/" className="flex items-center gap-3 group">
            <span className="font-display text-2xl text-gold-light group-hover:text-gold transition-colors">
              {CLAN_NAME}
            </span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) =>
              item.type === "link" ? (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-2 rounded-md text-sm font-body text-parchment hover:text-gold-light hover:bg-bark-brown-light transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <NavDropdown
                  key={item.label}
                  label={item.label}
                  items={item.items}
                  open={openDropdown === item.label}
                  onToggle={() => setOpenDropdown((prev) => (prev === item.label ? null : item.label))}
                  onClose={() => setOpenDropdown(null)}
                />
              )
            )}
            <ThemeToggle />
            <UserMenu />
          </div>

          {/* Mobile: theme toggle + hamburger */}
          <div className="flex md:hidden items-center gap-1">
            <ThemeToggle />
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="p-2 rounded-md text-parchment hover:text-gold-light hover:bg-bark-brown-light transition-colors"
              aria-label="Toggle navigation menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {mobileOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <div
          className={cn(
            "md:hidden overflow-hidden transition-all duration-300",
            mobileOpen ? "max-h-[800px] pb-4" : "max-h-0"
          )}
        >
          {MOBILE_NAV_ITEMS.map((link, i) => {
            const isNewGroup = link.group && MOBILE_NAV_ITEMS[i - 1]?.group !== link.group;
            return (
              <div key={link.href}>
                {isNewGroup && (
                  <p className="px-3 pt-3 pb-1 text-xs uppercase tracking-wide text-parchment/60">
                    {link.group}
                  </p>
                )}
                <Link
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "block py-2 rounded-md text-base font-body text-parchment hover:text-gold-light hover:bg-bark-brown-light transition-colors",
                    link.group ? "px-5" : "px-3"
                  )}
                >
                  {link.label}
                </Link>
              </div>
            );
          })}

          {/* Mobile auth section */}
          {authLoaded && (
            <>
              <div className="border-t border-bark-brown-light my-2" />
              {user ? (
                <>
                  <div className="flex items-center gap-3 px-3 py-2">
                    {user.user_metadata?.avatar_url ? (
                      <img
                        src={user.user_metadata.avatar_url}
                        alt=""
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gnome-green flex items-center justify-center text-sm text-text-light font-bold">
                        {(user.user_metadata?.full_name ?? "U").charAt(0).toUpperCase()}
                      </div>
                    )}
                    <span className="text-sm text-parchment font-semibold">
                      {user.user_metadata?.full_name ?? "User"}
                    </span>
                  </div>
                  <Link
                    href="/account"
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-body text-parchment hover:text-gold-light hover:bg-bark-brown-light transition-colors"
                  >
                    My Account / Link RSN
                  </Link>
                  <Link
                    href="/gn0mebook/edit"
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-body text-parchment hover:text-gold-light hover:bg-bark-brown-light transition-colors"
                  >
                    My Gn0meBook Profile
                  </Link>
                  <Link
                    href="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-body text-parchment hover:text-gold-light hover:bg-bark-brown-light transition-colors"
                  >
                    Admin Panel
                  </Link>
                  <Link
                    href="/apply"
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-body text-parchment hover:text-gold-light hover:bg-bark-brown-light transition-colors"
                  >
                    Apply for Staff
                  </Link>
                  <button
                    onClick={() => { setMobileOpen(false); handleLogout(); }}
                    className="block w-full text-left px-3 py-2 rounded-md text-base font-body text-red-accent hover:bg-bark-brown-light transition-colors cursor-pointer"
                  >
                    Log Out
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="block px-3 py-2 rounded-md text-base font-body text-gold hover:text-gold-light hover:bg-bark-brown-light transition-colors font-semibold"
                >
                  Login with Discord
                </Link>
              )}
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
