"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { activeNavHref } from "@/lib/admin-nav";

interface NavItem {
  href: string;
  label: string;
  group: string;
  alsoActiveOn?: string[];
  badgeCount: number;
}

const COLLAPSED_STORAGE_KEY = "admin-nav-collapsed";

function readCollapsed(): string[] {
  try {
    const raw = window.localStorage.getItem(COLLAPSED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((g): g is string => typeof g === "string") : [];
  } catch {
    return [];
  }
}

function writeCollapsed(groups: string[]) {
  try {
    window.localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(groups));
  } catch {
    // Storage unavailable (private window etc.) -- collapsing just won't persist.
  }
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={cn("w-4 h-4 transition-transform shrink-0", open ? "rotate-90" : "")}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function Badge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-2 min-w-5 px-1.5 rounded-full bg-red-accent text-white text-[11px] font-semibold leading-5 text-center shrink-0">
      {count > 99 ? "99+" : count}
    </span>
  );
}

export function AdminSidebar({ navItems, children }: { navItems: NavItem[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  // Every group starts expanded; the ones an admin collapses are remembered
  // in this browser. The group holding the current page always shows open.
  const [collapsed, setCollapsed] = useState<string[]>([]);

  useEffect(() => {
    // Read after mount (from a promise callback, not synchronously in the
    // effect) so the server render and first client render match.
    void Promise.resolve().then(() => setCollapsed(readCollapsed()));
  }, []);

  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setMobileOpen(false);
  }

  const activeHref = activeNavHref(pathname, navItems);

  const groups: { name: string; items: NavItem[] }[] = [];
  for (const item of navItems) {
    let group = groups.find((g) => g.name === item.group);
    if (!group) {
      group = { name: item.group, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }

  const toggleGroup = (name: string) => {
    setCollapsed((prev) => {
      const next = prev.includes(name) ? prev.filter((g) => g !== name) : [...prev, name];
      writeCollapsed(next);
      return next;
    });
  };

  const linkClass = (href: string) =>
    cn(
      "flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors",
      href === activeHref
        ? "bg-gnome-green/15 text-gnome-green font-semibold"
        : "text-bark-brown hover:bg-parchment-dark hover:text-gnome-green"
    );

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <aside className="md:w-56 shrink-0">
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="md:hidden w-full flex items-center justify-between px-3 py-2 mb-2 rounded-md border border-bark-brown-light bg-parchment-dark/40 text-bark-brown font-semibold cursor-pointer"
        >
          <span className="font-display text-lg text-gnome-green">Admin Panel</span>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        <h2 className="hidden md:block font-display text-xl text-gnome-green mb-4">Admin Panel</h2>

        <nav className={cn("md:block overflow-hidden transition-all", mobileOpen ? "max-h-[3000px]" : "max-h-0 md:max-h-none")}>
          {groups.map((group) => {
            const containsActive = group.items.some((item) => item.href === activeHref);
            const isOpen = containsActive || !collapsed.includes(group.name);
            const groupBadge = group.items.reduce((sum, item) => sum + item.badgeCount, 0);
            return (
              <div key={group.name} className="pt-2 first:pt-0">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.name)}
                  disabled={containsActive}
                  className="w-full flex items-center justify-between px-3 py-1 text-xs font-semibold uppercase tracking-wide text-iron-grey hover:text-gnome-green transition-colors cursor-pointer disabled:cursor-default disabled:hover:text-iron-grey"
                >
                  <span className="flex items-center min-w-0 text-left">
                    <span className="truncate">{group.name}</span>
                    {!isOpen && <Badge count={groupBadge} />}
                  </span>
                  <ChevronIcon open={isOpen} />
                </button>
                {isOpen && (
                  <div className="space-y-0.5 mt-1">
                    {group.items.map((item) => (
                      <Link key={item.href} href={item.href} className={linkClass(item.href)}>
                        <span className="truncate">{item.label}</span>
                        <Badge count={item.badgeCount} />
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
