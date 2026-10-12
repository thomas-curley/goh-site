"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Tab strip linking sibling admin pages that belong together (e.g.
 * Permissions + Section Visibility). Each tab is its own route, so the
 * pages keep their own permissions and URLs.
 */
export function AdminTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 border-b border-parchment-dark mb-6 overflow-x-auto">
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "px-4 py-2 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors",
              active ? "border-gnome-green text-gnome-green font-semibold" : "border-transparent text-bark-brown hover:text-gnome-green"
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
