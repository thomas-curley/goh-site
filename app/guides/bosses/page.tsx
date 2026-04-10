import { Card } from "@/components/ui/Card";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Boss Guides",
  description: "Strategies, gear setups, and tips for OSRS bosses from entry-level to endgame.",
};

const BOSS_TIERS = [
  {
    tier: "Entry Level",
    bosses: [
      { name: "Barrows", wiki: "https://oldschool.runescape.wiki/w/Barrows/Strategies" },
      { name: "Giant Mole", wiki: "https://oldschool.runescape.wiki/w/Giant_Mole/Strategies" },
      { name: "King Black Dragon", wiki: "https://oldschool.runescape.wiki/w/King_Black_Dragon/Strategies" },
      { name: "Sarachnis", wiki: "https://oldschool.runescape.wiki/w/Sarachnis/Strategies" },
    ],
  },
  {
    tier: "Mid Tier",
    bosses: [
      { name: "Zulrah", wiki: "https://oldschool.runescape.wiki/w/Zulrah/Strategies" },
      { name: "Vorkath", wiki: "https://oldschool.runescape.wiki/w/Vorkath/Strategies" },
      { name: "Dagannoth Kings", wiki: "https://oldschool.runescape.wiki/w/Dagannoth_Kings/Strategies" },
      { name: "Grotesque Guardians", wiki: "https://oldschool.runescape.wiki/w/Grotesque_Guardians/Strategies" },
    ],
  },
  {
    tier: "Endgame",
    bosses: [
      { name: "Nex", wiki: "https://oldschool.runescape.wiki/w/Nex/Strategies" },
      { name: "Nightmare", wiki: "https://oldschool.runescape.wiki/w/The_Nightmare/Strategies" },
      { name: "Phantom Muspah", wiki: "https://oldschool.runescape.wiki/w/Phantom_Muspah/Strategies" },
      { name: "Araxxor", wiki: "https://oldschool.runescape.wiki/w/Araxxor/Strategies" },
      { name: "The Leviathan", wiki: "https://oldschool.runescape.wiki/w/The_Leviathan/Strategies" },
      { name: "The Whisperer", wiki: "https://oldschool.runescape.wiki/w/The_Whisperer/Strategies" },
      { name: "Vardorvis", wiki: "https://oldschool.runescape.wiki/w/Vardorvis/Strategies" },
      { name: "Duke Sucellus", wiki: "https://oldschool.runescape.wiki/w/Duke_Sucellus/Strategies" },
    ],
  },
];

export default function BossesGuidePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link href="/guides" className="inline-flex items-center text-sm text-gnome-green hover:text-gnome-green-light mb-6 gap-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Guides
      </Link>

      <h1 className="font-display text-4xl text-gnome-green mb-2">Boss Guides</h1>
      <p className="text-bark-brown-light mb-8">
        Strategies and gear setups for OSRS bosses, sorted by difficulty.
        Ask a Pine+ rank for learner trips on any boss!
      </p>

      {BOSS_TIERS.map((tier) => (
        <section key={tier.tier} className="mb-10">
          <h2 className="font-display text-2xl text-bark-brown mb-4">{tier.tier}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tier.bosses.map((boss) => (
              <a key={boss.name} href={boss.wiki} target="_blank" rel="noopener noreferrer">
                <Card className="flex items-center justify-between">
                  <span className="font-body font-semibold text-bark-brown">{boss.name}</span>
                  <span className="text-sm text-gnome-green">Wiki &rarr;</span>
                </Card>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
