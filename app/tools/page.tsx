import { Card } from "@/components/ui/Card";
import Link from "next/link";
import { OWNER_TOOLS, WOM_GROUP_URL } from "@/lib/constants";
import { checkSectionAccess } from "@/lib/section-gate";
import { SectionUnavailable } from "@/components/layout/SectionUnavailable";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tools & Links",
  description: "Useful OSRS tools, calculators, RuneLite plugins, and clan resources.",
};

const SITE_TOOLS = [
  {
    name: "Loot Split Calculator",
    href: "/loot-split",
    description: "Search items for live Grand Exchange prices, add participants, and split the loot.",
  },
];

const SPOTLIGHT_TOOLS = [
  {
    name: "OSRS Portal",
    url: "https://osrsportal.com",
    description: "A great lineup of OSRS tools and calculators — our favorite is their Mastering Mixology helper below.",
    highlight: { name: "Mastering Mixology Tool", url: "https://osrsportal.com/mixology" },
  },
];

const COMMUNITY_TOOLS = [
  {
    name: "Wise Old Man",
    url: WOM_GROUP_URL,
    description: "Track XP gains, competitions, achievements, and group stats.",
  },
  {
    name: "OSRS Wiki",
    url: "https://oldschool.runescape.wiki",
    description: "The definitive resource for all things OSRS — guides, item stats, quest walkthroughs.",
  },
  {
    name: "GearScape DPS Calculator",
    url: "https://gearscape.net",
    description: "Calculate DPS for any gear setup against any monster.",
  },
  {
    name: "Collection Log",
    url: "https://collectionlog.net",
    description: "Track and share your collection log progress online.",
  },
  {
    name: "RuneLite",
    url: "https://runelite.net",
    description: "The most popular OSRS client. Must-have plugins: Quest Helper, Inventory Setups, Bank Tags.",
  },
  {
    name: "Boat Planner",
    url: "https://boatplannerrs.com",
    description: "Plan out your OSRS boat routes.",
  },
];

export default async function ToolsPage() {
  if (!(await checkSectionAccess("tools"))) return <SectionUnavailable />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="font-display text-4xl text-gnome-green mb-2">Tools & Links</h1>
      <p className="text-bark-brown-light mb-8">
        Curated tools, calculators, and resources for OSRS players.
      </p>

      {/* Site Tools */}
      <section className="mb-10">
        <h2 className="font-display text-2xl text-bark-brown mb-4">Site Tools</h2>
        <div className="space-y-3">
          {SITE_TOOLS.map((tool) => (
            <Link key={tool.name} href={tool.href}>
              <Card className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-bark-brown">{tool.name}</h3>
                  <p className="text-xs text-bark-brown-light">{tool.description}</p>
                </div>
                <span className="text-sm text-gnome-green shrink-0 ml-4">Open &rarr;</span>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      {/* Clan Tools */}
      <section className="mb-10">
        <h2 className="font-display text-2xl text-bark-brown mb-4">Our Tools</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {OWNER_TOOLS.map((tool) => (
            <a key={tool.name} href={tool.url} target="_blank" rel="noopener noreferrer">
              <Card className="text-center h-full">
                <h3 className="font-display text-lg text-gnome-green">{tool.name}</h3>
                <p className="text-xs text-iron-grey mt-1">{tool.url}</p>
              </Card>
            </a>
          ))}
        </div>
      </section>

      {/* Community Spotlight */}
      <section className="mb-10">
        <h2 className="font-display text-2xl text-bark-brown mb-4">Community Spotlight</h2>
        <div className="space-y-3">
          {SPOTLIGHT_TOOLS.map((tool) => (
            <Card key={tool.name} className="mb-3">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <a href={tool.url} target="_blank" rel="noopener noreferrer">
                    <h3 className="font-semibold text-bark-brown hover:text-gnome-green transition-colors">{tool.name}</h3>
                  </a>
                  <p className="text-xs text-bark-brown-light mt-1">{tool.description}</p>
                </div>
                <a
                  href={tool.highlight.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-sm px-3 py-1.5 rounded-md bg-gnome-green/15 text-gnome-green font-semibold hover:bg-gnome-green/25 transition-colors"
                >
                  {tool.highlight.name} &rarr;
                </a>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Community Tools */}
      <section className="mb-10">
        <h2 className="font-display text-2xl text-bark-brown mb-4">Community Tools</h2>
        <div className="space-y-3">
          {COMMUNITY_TOOLS.map((tool) => (
            <a key={tool.name} href={tool.url} target="_blank" rel="noopener noreferrer">
              <Card className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-bark-brown">{tool.name}</h3>
                  <p className="text-xs text-bark-brown-light">{tool.description}</p>
                </div>
                <span className="text-sm text-gnome-green shrink-0 ml-4">Visit &rarr;</span>
              </Card>
            </a>
          ))}
        </div>
      </section>

      {/* RuneLite Plugins Link */}
      <section>
        <Link href="/guides/runelite">
          <Card className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl text-bark-brown">RuneLite Plugins</h2>
              <p className="text-sm text-bark-brown-light">
                Full guide to recommended plugins — essentials, PvM, skilling, QoL, and clan picks.
              </p>
            </div>
            <span className="text-sm text-gnome-green font-semibold shrink-0 ml-4">View Guide &rarr;</span>
          </Card>
        </Link>
      </section>
    </div>
  );
}
