import { Card } from "@/components/ui/Card";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PvM General Guides",
  description: "Slayer block lists, combat achievement guides, supply checklists, and money-making methods.",
};

const SECTIONS = [
  {
    title: "Slayer Task Recommendations",
    items: [
      "Block list depends on your goals — XP vs. GP vs. boss tasks",
      "Common blocks: Spiritual creatures, Drakes, Wyrms (if not profitable for you)",
      "Always skip: Steel/Iron Dragons (unless doing metal dragon tasks for CA)",
      "Extend: Dust Devils, Nechryaels, Gargoyles (burst/barrage tasks)",
    ],
  },
  {
    title: "Combat Achievement Tips",
    items: [
      "Start with Easy tier — many are just \"kill X boss\" tasks",
      "Medium tier unlocks the Ghommal's Hilt 2 (useful teleport)",
      "Work on CAs passively while doing regular PvM",
      "Check the OSRS Wiki for specific task requirements and strategies",
    ],
  },
  {
    title: "Supply Checklist for PvM",
    items: [
      "Super combat potions / Ranging potions",
      "Prayer potions / Super restores",
      "Anglerfish for overheal, Sharks/Manta rays for general healing",
      "Rune pouch with spell runes",
      "Stamina potions for longer trips",
      "Teleport tabs (House, Ferox Enclave)",
    ],
  },
];

export default function PvmGuidePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link href="/guides" className="inline-flex items-center text-sm text-gnome-green hover:text-gnome-green-light mb-6 gap-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Guides
      </Link>

      <h1 className="font-display text-4xl text-gnome-green mb-2">PvM General</h1>
      <p className="text-bark-brown-light mb-8">
        General PvM tips, slayer recommendations, and supply checklists.
      </p>

      <div className="space-y-8">
        {SECTIONS.map((section) => (
          <Card key={section.title} hover={false}>
            <h2 className="font-display text-xl text-bark-brown mb-3">{section.title}</h2>
            <ul className="space-y-2">
              {section.items.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm text-bark-brown-light">
                  <span className="text-gnome-green shrink-0">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
