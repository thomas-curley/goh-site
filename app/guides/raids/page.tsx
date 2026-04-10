import { Card } from "@/components/ui/Card";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Raids Guides",
  description: "Gear setups, role breakdowns, and tips for CoX, ToB, and ToA.",
};

const RAIDS = [
  {
    name: "Chambers of Xeric (CoX)",
    description: "Recommended gear setups from budget to endgame, role breakdowns for each room, and tips for efficient runs.",
    difficulty: "Mid-High",
    wikiUrl: "https://oldschool.runescape.wiki/w/Chambers_of_Xeric/Strategies",
  },
  {
    name: "Theatre of Blood (ToB)",
    description: "Role assignments, gear switches, and strategies for each room from Maiden to Verzik.",
    difficulty: "High",
    wikiUrl: "https://oldschool.runescape.wiki/w/Theatre_of_Blood/Strategies",
  },
  {
    name: "Tombs of Amascut (ToA)",
    description: "Invocation setups for different raid levels, path strategies, and gear recommendations.",
    difficulty: "Scalable",
    wikiUrl: "https://oldschool.runescape.wiki/w/Tombs_of_Amascut/Strategies",
  },
];

export default function RaidsGuidePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link href="/guides" className="inline-flex items-center text-sm text-gnome-green hover:text-gnome-green-light mb-6 gap-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Guides
      </Link>

      <h1 className="font-display text-4xl text-gnome-green mb-2">Raids Guides</h1>
      <p className="text-bark-brown-light mb-8">
        Gear setups, strategies, and tips for all three OSRS raids. Ask a Pine+
        rank in Discord for learner trips!
      </p>

      <div className="space-y-6">
        {RAIDS.map((raid) => (
          <Card key={raid.name} hover={false}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl text-bark-brown mb-1">{raid.name}</h2>
                <p className="text-sm text-bark-brown-light mb-3">{raid.description}</p>
                <span className="text-xs text-iron-grey">
                  Difficulty: <span className="font-semibold">{raid.difficulty}</span>
                </span>
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <a
                href={raid.wikiUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-gnome-green hover:text-gnome-green-light underline"
              >
                OSRS Wiki Strategy Guide &rarr;
              </a>
            </div>
          </Card>
        ))}
      </div>

      <Card hover={false} className="mt-8 bg-parchment-dark text-center py-6">
        <p className="text-bark-brown-light text-sm">
          Detailed clan-specific guides with gear tables and role breakdowns are
          coming soon. In the meantime, ask in Discord for learner trips!
        </p>
      </Card>
    </div>
  );
}
