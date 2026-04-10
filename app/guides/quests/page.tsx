import { Card } from "@/components/ui/Card";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Quest Guides",
  description: "Must-do quests, optimal quest order, and key unlocks for OSRS.",
};

const MUST_DO_QUESTS = [
  { name: "Recipe for Disaster", unlock: "Barrows Gloves", wiki: "https://oldschool.runescape.wiki/w/Recipe_for_Disaster" },
  { name: "Dragon Slayer II", unlock: "Vorkath, Rune Dragons", wiki: "https://oldschool.runescape.wiki/w/Dragon_Slayer_II" },
  { name: "Song of the Elves", unlock: "Prifddinas, Gauntlet, Zalcano", wiki: "https://oldschool.runescape.wiki/w/Song_of_the_Elves" },
  { name: "Monkey Madness II", unlock: "Demonic Gorillas, Zenyte jewelry", wiki: "https://oldschool.runescape.wiki/w/Monkey_Madness_II" },
  { name: "A Night at the Theatre", unlock: "Theatre of Blood entry", wiki: "https://oldschool.runescape.wiki/w/A_Night_at_the_Theatre" },
  { name: "Beneath Cursed Sands", unlock: "Tombs of Amascut entry", wiki: "https://oldschool.runescape.wiki/w/Beneath_Cursed_Sands" },
  { name: "Desert Treasure I", unlock: "Ancient Magicks", wiki: "https://oldschool.runescape.wiki/w/Desert_Treasure_I" },
  { name: "Desert Treasure II", unlock: "DT2 Bosses (Leviathan, Whisperer, etc.)", wiki: "https://oldschool.runescape.wiki/w/Desert_Treasure_II_-_The_Fallen_Empire" },
  { name: "Lunar Diplomacy", unlock: "Lunar Spellbook", wiki: "https://oldschool.runescape.wiki/w/Lunar_Diplomacy" },
  { name: "King's Ransom", unlock: "Piety prayer", wiki: "https://oldschool.runescape.wiki/w/King%27s_Ransom" },
];

export default function QuestsGuidePage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link href="/guides" className="inline-flex items-center text-sm text-gnome-green hover:text-gnome-green-light mb-6 gap-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Guides
      </Link>

      <h1 className="font-display text-4xl text-gnome-green mb-2">Quest Guides</h1>
      <p className="text-bark-brown-light mb-8">
        Priority quests every clan member should complete, plus links to full
        OSRS Wiki guides.
      </p>

      <h2 className="font-display text-2xl text-bark-brown mb-4">Must-Do Quests</h2>
      <div className="space-y-3">
        {MUST_DO_QUESTS.map((quest) => (
          <a key={quest.name} href={quest.wiki} target="_blank" rel="noopener noreferrer">
            <Card className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-bark-brown">{quest.name}</h3>
                <p className="text-xs text-iron-grey">Unlocks: {quest.unlock}</p>
              </div>
              <span className="text-sm text-gnome-green shrink-0">Wiki &rarr;</span>
            </Card>
          </a>
        ))}
      </div>

      <Card hover={false} className="mt-8 text-center py-6">
        <p className="text-sm text-bark-brown-light">
          For a full optimal quest order, check the{" "}
          <a
            href="https://oldschool.runescape.wiki/w/Optimal_quest_guide"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gnome-green hover:text-gnome-green-light underline"
          >
            OSRS Wiki Optimal Quest Guide
          </a>
          .
        </p>
      </Card>
    </div>
  );
}
