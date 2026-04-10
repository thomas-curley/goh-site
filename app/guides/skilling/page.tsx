import { Card } from "@/components/ui/Card";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Skilling Guides",
  description: "Efficient training methods and money-making skilling for OSRS.",
};

const SKILL_GUIDES = [
  {
    skill: "Mining",
    methods: ["Motherlode Mine (AFK)", "3-tick Granite (fast XP)", "Shooting Stars (social)", "Volcanic Mine (efficient)"],
  },
  {
    skill: "Woodcutting",
    methods: ["Sulliuscep Woodcutting (best XP)", "Redwoods (AFK)", "2-tick Teaks (fast)", "Forestry events (social)"],
  },
  {
    skill: "Fishing",
    methods: ["Barbarian Fishing (fast + Agility/Strength XP)", "Karambwans (good GP + AFK)", "Tempoross (minigame)", "Minnows → Sharks (GP)"],
  },
  {
    skill: "Runecraft",
    methods: ["Guardians of the Rift (best for most players)", "Blood runes (AFK at 77+)", "Lava runes (fastest XP)", "ZMI Altar (balanced)"],
  },
  {
    skill: "Agility",
    methods: ["Rooftop courses for Marks of Grace", "Hallowed Sepulchre (best XP + GP post-72)", "Brimhaven Agility Arena (early)", "Ape Atoll (fast at lower levels)"],
  },
  {
    skill: "Herblore",
    methods: ["Prayer potions → Super restores (GP efficient)", "Stamina potions (break even)", "Saradomin brews (fast XP)", "Cleaning herbs (slow but profit)"],
  },
];

export default function SkillingGuidePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link href="/guides" className="inline-flex items-center text-sm text-gnome-green hover:text-gnome-green-light mb-6 gap-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Guides
      </Link>

      <h1 className="font-display text-4xl text-gnome-green mb-2">Skilling Guides</h1>
      <p className="text-bark-brown-light mb-8">
        Efficient training methods for popular skills. Great for SOTW
        competitions and general progression.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {SKILL_GUIDES.map((guide) => (
          <Card key={guide.skill} hover={false}>
            <h2 className="font-display text-lg text-bark-brown mb-3">{guide.skill}</h2>
            <ul className="space-y-1.5">
              {guide.methods.map((method, i) => (
                <li key={i} className="flex gap-2 text-sm text-bark-brown-light">
                  <span className="text-gnome-green shrink-0">•</span>
                  {method}
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>

      <Card hover={false} className="mt-8 text-center py-6">
        <p className="text-sm text-bark-brown-light">
          For detailed XP rates and calculators, check the{" "}
          <a
            href="https://oldschool.runescape.wiki/w/Efficiency"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gnome-green hover:text-gnome-green-light underline"
          >
            OSRS Wiki Efficiency Guide
          </a>
          .
        </p>
      </Card>
    </div>
  );
}
