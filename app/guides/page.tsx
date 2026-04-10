import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Guides & Resources",
  description: "PvM guides, boss strategies, quest guides, skilling methods, and useful tools for OSRS.",
};

const GUIDE_CATEGORIES = [
  {
    title: "Raids",
    href: "/guides/raids",
    description: "Theatre of Blood, Chambers of Xeric, Tombs of Amascut — gear setups, role breakdowns, and tips.",
    icon: "crossed-swords",
  },
  {
    title: "Bosses",
    href: "/guides/bosses",
    description: "From Giant Mole to Nex — recommended stats, gear, inventory setups, and strategies.",
    icon: "skull",
  },
  {
    title: "Quests",
    href: "/guides/quests",
    description: "Must-do quests, optimal quest order, and key unlocks like Barrows Gloves and Song of the Elves.",
    icon: "scroll",
  },
  {
    title: "PvM General",
    href: "/guides/pvm",
    description: "Slayer block lists, combat achievement guides, prayer/potion checklists, and money-making.",
    icon: "shield",
  },
  {
    title: "Skilling",
    href: "/guides/skilling",
    description: "Efficient training methods, money-making skills, and competition prep guides.",
    icon: "pickaxe",
  },
  {
    title: "Tools & Links",
    href: "/guides/tools",
    description: "DPS calculators, RuneLite plugins, collection log trackers, and our own clan tools.",
    icon: "wrench",
  },
];

const ICONS: Record<string, string> = {
  "crossed-swords": "M6 6l12 12M6 18L18 6",
  skull: "M12 2a8 8 0 00-8 8c0 3 1.5 5.5 4 7v3h8v-3c2.5-1.5 4-4 4-7a8 8 0 00-8-8zm-2 13h1v2h-1v-2zm3 0h1v2h-1v-2z",
  scroll: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 012-2h2a2 2 0 012 2M9 5h6",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  pickaxe: "M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z",
  wrench: "M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z",
};

export default function GuidesPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <h1 className="font-display text-4xl text-gnome-green mb-2">
        Guides & Resources
      </h1>
      <p className="text-bark-brown-light mb-10">
        Everything you need to level up your OSRS game. Clan-curated guides,
        strategies, and useful tools.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {GUIDE_CATEGORIES.map((cat) => (
          <Link key={cat.href} href={cat.href}>
            <Card className="h-full flex flex-col">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-gnome-green/10 flex items-center justify-center">
                  <svg
                    className="w-5 h-5 text-gnome-green"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d={ICONS[cat.icon] ?? ICONS.shield} />
                  </svg>
                </div>
                <h2 className="font-display text-xl text-bark-brown">
                  {cat.title}
                </h2>
              </div>
              <p className="text-sm text-bark-brown-light flex-1">
                {cat.description}
              </p>
              <span className="text-sm text-gnome-green font-semibold mt-3 inline-block">
                View Guides &rarr;
              </span>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
