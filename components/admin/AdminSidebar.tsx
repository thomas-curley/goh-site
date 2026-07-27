"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  group?: string;
}

const COLLAPSED_GROUPS_KEY = "admin_nav_collapsed_groups";

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

export function AdminSidebar({ navItems, children }: { navItems: NavItem[]; children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [loadedPrefs, setLoadedPrefs] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(COLLAPSED_GROUPS_KEY);
      if (stored) setCollapsedGroups(new Set(JSON.parse(stored)));
    } catch {
      // ignore malformed/unavailable storage
    }
    setLoadedPrefs(true);
  }, []);

  // Close the mobile panel on navigation.
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const toggleGroup = (name: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      if (loadedPrefs) {
        try {
          localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify([...next]));
        } catch {
          // ignore storage failures (private browsing, quota, etc.)
        }
      }
      return next;
    });
  };

  const ungrouped = navItems.filter((item) => !item.group);
  const groups: { name: string; items: NavItem[] }[] = [];
  for (const item of navItems) {
    if (!item.group) continue;
    let group = groups.find((g) => g.name === item.group);
    if (!group) {
      group = { name: item.group, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }

  const linkClass = (href: string) =>
    cn(
      "block px-3 py-2 rounded-md text-sm transition-colors",
      pathname === href
        ? "bg-gnome-green/15 text-gnome-green font-semibold"
        : "text-bark-brown hover:bg-parchment-dark hover:text-gnome-green"
    );

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <aside className="md:w-52 shrink-0">
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

        <h2 className="hidden md:block font-display text-xl text-gnome-green mb-4">
          Admin Panel
        </h2>

        <nav className={cn("md:block overflow-hidden transition-all", mobileOpen ? "max-h-[2000px]" : "max-h-0 md:max-h-none")}>
          <div className="space-y-1 pb-1">
            {ungrouped.map((item) => (
              <Link key={item.href} href={item.href} className={linkClass(item.href)}>
                {item.label}
              </Link>
            ))}
          </div>

          {groups.map((group) => {
            const collapsed = collapsedGroups.has(group.name);
            return (
              <div key={group.name} className="pt-2">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.name)}
                  className="w-full flex items-center justify-between px-3 py-1 text-xs font-semibold uppercase tracking-wide text-iron-grey hover:text-gnome-green transition-colors cursor-pointer"
                >
                  {group.name}
                  <ChevronIcon open={!collapsed} />
                </button>
                {!collapsed && (
                  <div className="space-y-1 mt-1">
                    {group.items.map((item) => (
                      <Link key={item.href} href={item.href} className={linkClass(item.href)}>
                        {item.label}
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
