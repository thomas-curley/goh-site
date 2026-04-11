"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { CLAN_NAME } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./ThemeToggle";
import { UserMenu } from "./UserMenu";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { User } from "@supabase/supabase-js";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/events", label: "Events" },
  { href: "/guides", label: "Guides" },
  { href: "/members", label: "Members" },
  { href: "/hiscores", label: "Hiscores" },
  { href: "/about", label: "About" },
];

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
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
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="px-3 py-2 rounded-md text-sm font-body text-parchment hover:text-gold-light hover:bg-bark-brown-light transition-colors"
              >
                {link.label}
              </Link>
            ))}
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
            mobileOpen ? "max-h-[500px] pb-4" : "max-h-0"
          )}
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-body text-parchment hover:text-gold-light hover:bg-bark-brown-light transition-colors"
            >
              {link.label}
            </Link>
          ))}

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
                    href="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2 rounded-md text-base font-body text-parchment hover:text-gold-light hover:bg-bark-brown-light transition-colors"
                  >
                    Admin Panel
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
