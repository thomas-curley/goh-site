"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { CLAN_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { NavDropdown } from "./NavDropdown";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useIsStaff } from "@/lib/use-is-staff";
import type { SiteSectionKey } from "@/lib/site-sections";
import type { User } from "@supabase/supabase-js";

interface SubNavItem {
  href: string;
  label: string;
  // Hides this item from the nav entirely for non-staff, rather than
  // showing it and letting the page's own gate screen turn people away --
  // purely a UI convenience (see lib/use-is-staff.ts), the real access
  // check still lives server-side on each page.
  requiredTier?: "staff";
  // Same idea, but the staff-only-ness is admin-toggled at runtime (see
  // lib/site-sections.ts + /admin/sections) instead of permanently hardcoded
  // -- for features not released yet that'll eventually open up to everyone.
  sectionKey?: SiteSectionKey;
}

type NavItem =
  | { type: "link"; href: string; label: string }
  | { type: "dropdown"; label: string; items: SubNavItem[] };

const NAV_ITEMS: NavItem[] = [
  { type: "link", href: "/", label: "Home" },
  { type: "link", href: "/events", label: "Events" },
  {
    type: "dropdown",
    label: "Members",
    items: [
      { href: "/gn0mebook", label: "Gn0meBook" },
      { href: "/staff-handbook", label: "Staff Handbook", requiredTier: "staff" },
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
      { href: "/review-a-gnomie", label: "Review a Gn0mie" },
    ],
  },
  {
    type: "dropdown",
    label: "Bank",
    items: [
      { href: "/loans", label: "Browse Loans", sectionKey: "bank" },
      { href: "/loans/apply", label: "Request a Loan", sectionKey: "bank" },
    ],
  },
  { type: "link", href: "/about", label: "About" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  // Separate accordion state for the mobile panel's dropdown groups -- only
  // one open at a time, so the list stays short instead of every group's
  // items being visible (and the whole menu needing to scroll) at once.
  const [mobileOpenGroup, setMobileOpenGroup] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [staffOnlySections, setStaffOnlySections] = useState<Set<string>>(new Set());
  const isStaff = useIsStaff();

  useEffect(() => {
    fetch("/api/site-sections/staff-only")
      .then((res) => res.json())
      .then((data) => setStaffOnlySections(new Set(Array.isArray(data.keys) ? data.keys : [])))
      .catch(() => {});
  }, []);

  const visibleNavItems = useMemo(() => {
    return NAV_ITEMS.map((item) => {
      if (item.type === "link") return item;
      const items = item.items.filter((sub) => {
        if (sub.requiredTier === "staff" && !isStaff) return false;
        if (sub.sectionKey && staffOnlySections.has(sub.sectionKey) && !isStaff) return false;
        return true;
      });
      return items.length > 0 ? { ...item, items } : null;
    }).filter((item): item is NavItem => item !== null);
  }, [isStaff, staffOnlySections]);

  const closeMobileMenu = () => {
    setMobileOpen(false);
    setMobileOpenGroup(null);
  };

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
            {visibleNavItems.map((item) =>
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
              onClick={() => (mobileOpen ? closeMobileMenu() : setMobileOpen(true))}
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

        {/* Mobile menu -- an accordion (one dropdown group open at a time)
            inside its own scrollable region, so it never grows taller than
            the viewport and clips off unreachable links the way a fixed
            max-height would. */}
        <div
          className={cn(
            "md:hidden transition-all duration-300",
            mobileOpen ? "max-h-[calc(100vh-4rem)] overflow-y-auto pb-4" : "max-h-0 overflow-hidden"
          )}
        >
          {visibleNavItems.map((item) => {
            if (item.type === "link") {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobileMenu}
                  className="block px-3 py-2.5 rounded-md text-base font-body text-parchment hover:text-gold-light hover:bg-bark-brown-light transition-colors"
                >
                  {item.label}
                </Link>
              );
            }

            const isOpen = mobileOpenGroup === item.label;
            return (
              <div key={item.label} className="border-t border-bark-brown-light/40 first:border-t-0">
                <button
                  type="button"
                  onClick={() => setMobileOpenGroup((prev) => (prev === item.label ? null : item.label))}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-md text-base font-body text-parchment hover:text-gold-light hover:bg-bark-brown-light transition-colors cursor-pointer"
                >
                  {item.label}
                  <svg
                    className={cn("w-4 h-4 transition-transform shrink-0", isOpen ? "rotate-180" : "")}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="pb-1">
                    {item.items.map((sub) => (
                      <Link
                        key={sub.href}
                        href={sub.href}
                        onClick={closeMobileMenu}
                        className="block px-6 py-2 rounded-md text-sm font-body text-parchment/90 hover:text-gold-light hover:bg-bark-brown-light transition-colors"
                      >
                        {sub.label}
                      </Link>
                    ))}
                  </div>
                )}
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
                    onClick={closeMobileMenu}
                    className="block px-3 py-2 rounded-md text-base font-body text-parchment hover:text-gold-light hover:bg-bark-brown-light transition-colors"
                  >
                    My Account / Link RSN
                  </Link>
                  <Link
                    href="/gn0mebook/edit"
                    onClick={closeMobileMenu}
                    className="block px-3 py-2 rounded-md text-base font-body text-parchment hover:text-gold-light hover:bg-bark-brown-light transition-colors"
                  >
                    My Gn0meBook Profile
                  </Link>
                  <Link
                    href="/admin"
                    onClick={closeMobileMenu}
                    className="block px-3 py-2 rounded-md text-base font-body text-parchment hover:text-gold-light hover:bg-bark-brown-light transition-colors"
                  >
                    Admin Panel
                  </Link>
                  <Link
                    href="/apply"
                    onClick={closeMobileMenu}
                    className="block px-3 py-2 rounded-md text-base font-body text-parchment hover:text-gold-light hover:bg-bark-brown-light transition-colors"
                  >
                    Apply for Staff
                  </Link>
                  <button
                    onClick={() => { closeMobileMenu(); handleLogout(); }}
                    className="block w-full text-left px-3 py-2 rounded-md text-base font-body text-red-accent hover:bg-bark-brown-light transition-colors cursor-pointer"
                  >
                    Log Out
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  onClick={closeMobileMenu}
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
