import { Card } from "@/components/ui/Card";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RuneLite Plugins",
  description: "Recommended RuneLite plugins for OSRS — essentials, PvM, skilling, QoL, and clan picks.",
};

interface Plugin {
  name: string;
  description: string;
  category: string;
  hub?: boolean; // true = Plugin Hub (not built-in)
  wikiUrl?: string;
}

const PLUGINS: Plugin[] = [
  // Essentials
  {
    name: "GPU",
    description: "Hardware-accelerated rendering with extended draw distance, anti-aliasing, and smoother performance. Turn this on first.",
    category: "Essentials",
  },
  {
    name: "Menu Entry Swapper",
    description: "Reorders right-click menus so the most common action is left-click. Bank, trade, travel, pickpocket — all one click.",
    category: "Essentials",
  },
  {
    name: "Ground Items",
    description: "Shows item names and values on the ground. Highlight valuable drops, hide junk. Essential for PvM and Slayer.",
    category: "Essentials",
  },
  {
    name: "Inventory Tags",
    description: "Color-code items in your inventory for quick identification. Great for gear switches and supplies.",
    category: "Essentials",
  },
  {
    name: "Bank Tags",
    description: "Organize your bank with custom tags and tab layouts. Search by tag, create gear presets, keep your bank clean.",
    category: "Essentials",
  },
  {
    name: "Loot Tracker",
    description: "Tracks all drops from NPCs and activities. Shows GP/hr, total loot value, and kill counts. Essential for tracking boss profits.",
    category: "Essentials",
  },
  {
    name: "XP Tracker",
    description: "Displays XP rates, time to level, and actions remaining. Shows per-hour rates and tracks session progress.",
    category: "Essentials",
  },

  // PvM & Combat
  {
    name: "Quest Helper",
    description: "Step-by-step in-game quest guides with highlighted paths, item requirements, and dialogue options. Makes questing painless.",
    category: "PvM & Combat",
  },
  {
    name: "Inventory Setups",
    description: "Save and load gear/inventory presets. One-click to see if you have the right setup for a boss. Supports bank filtering.",
    category: "PvM & Combat",
    hub: true,
  },
  {
    name: "Boss Timers",
    description: "Shows respawn timers for bosses after kills. Helps with efficiency at GWD, DKs, and other multi-kill trips.",
    category: "PvM & Combat",
  },
  {
    name: "Prayer Flicker Helper",
    description: "Highlights the correct prayer to use based on monster attacks. Helps learn prayer switching at bosses like Jad and Zuk.",
    category: "PvM & Combat",
  },
  {
    name: "Tile Indicators",
    description: "Mark tiles to track safe spots, boss mechanics, and movement patterns. Useful for learning new bosses.",
    category: "PvM & Combat",
  },
  {
    name: "Special Attack Counter",
    description: "Tracks special attack energy and counts specs used by your team. Useful for group PvM like Corp and raids.",
    category: "PvM & Combat",
  },
  {
    name: "CoX Scouter",
    description: "Scouts Chambers of Xeric layouts showing rooms, puzzles, and bosses before committing. Skip bad layouts.",
    category: "PvM & Combat",
    hub: true,
  },
  {
    name: "ToB Health Bars",
    description: "Shows detailed health bars for Theatre of Blood bosses and adds helpful overlays for each room.",
    category: "PvM & Combat",
    hub: true,
  },

  // Skilling
  {
    name: "Idle Notifier",
    description: "Plays a sound or flashes the client when your character stops performing an action. Never miss an AFK log again.",
    category: "Skilling",
  },
  {
    name: "Fishing",
    description: "Shows fishing spot types, tracks catch rates, and highlights the best spots. Alerts when spots move.",
    category: "Skilling",
  },
  {
    name: "Mining",
    description: "Shows rock respawn timers, highlights available rocks, and tracks mining rates.",
    category: "Skilling",
  },
  {
    name: "Agility",
    description: "Highlights clickboxes on agility courses, shows lap counter, and marks of grace locations.",
    category: "Skilling",
  },
  {
    name: "Hunter",
    description: "Shows trap status, highlights chin spots, and tracks catch rates. Makes birdhouse runs easier.",
    category: "Skilling",
  },
  {
    name: "Time Tracking",
    description: "Tracks farming patches, birdhouse runs, and other timed activities. Shows when patches are ready to harvest.",
    category: "Skilling",
  },

  // Quality of Life
  {
    name: "Runelite (Core)",
    description: "The base client includes world map, chat commands (!lvl, !kc, !price), screenshot tool, and dozens of small QoL features.",
    category: "Quality of Life",
  },
  {
    name: "Animation Smoothing",
    description: "Smooths player and NPC animations for a more polished visual experience. Purely cosmetic but looks great.",
    category: "Quality of Life",
  },
  {
    name: "Chat Notifications",
    description: "Get desktop notifications for trade requests, private messages, clan chat mentions, and custom keywords.",
    category: "Quality of Life",
  },
  {
    name: "Screenshot",
    description: "Auto-captures screenshots on level ups, boss kills, valuable drops, quest completions, and more.",
    category: "Quality of Life",
  },
  {
    name: "World Hopper",
    description: "Hop worlds from a side panel without logging out. Shows player counts and ping for each world.",
    category: "Quality of Life",
  },
  {
    name: "Clue Scroll Helper",
    description: "Solves clue scroll puzzles, shows dig locations on the map, and identifies anagram/cipher answers.",
    category: "Quality of Life",
  },

  // Clan Picks
  {
    name: "Discord Rich Presence",
    description: "Shows your current OSRS activity in your Discord status. Let clanmates see what you're up to.",
    category: "Clan Picks",
    hub: true,
  },
  {
    name: "Wise Old Man",
    description: "Integrates WOM tracking directly into RuneLite. Track XP gains and competitions without leaving the client.",
    category: "Clan Picks",
    hub: true,
  },
  {
    name: "Party",
    description: "Share your HP, prayer, and spec with party members in real-time. Great for group PvM and raids learning.",
    category: "Clan Picks",
  },
  {
    name: "DPS Counter",
    description: "Shows real-time DPS for you and your party. Compare performance and optimize gear setups.",
    category: "Clan Picks",
    hub: true,
  },
];

const CATEGORIES = ["Essentials", "PvM & Combat", "Skilling", "Quality of Life", "Clan Picks"];

export default function RuneLitePluginsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <Link href="/guides" className="inline-flex items-center text-sm text-gnome-green hover:text-gnome-green-light mb-6 gap-1">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Guides
      </Link>

      <h1 className="font-display text-4xl text-gnome-green mb-2">RuneLite Plugins</h1>
      <p className="text-bark-brown-light mb-4">
        Our recommended RuneLite plugins organized by category. Plugins marked with
        <span className="inline-flex items-center mx-1 px-1.5 py-0.5 rounded bg-gnome-green/10 text-gnome-green text-xs font-semibold">Hub</span>
        need to be installed from the Plugin Hub (wrench icon → Plugin Hub).
      </p>
      <p className="text-sm text-bark-brown-light mb-8">
        Download RuneLite at{" "}
        <a href="https://runelite.net" target="_blank" rel="noopener noreferrer" className="text-gnome-green hover:text-gnome-green-light underline">
          runelite.net
        </a>
        . It&apos;s the only safe third-party client — avoid all others.
      </p>

      {/* Quick nav */}
      <div className="flex flex-wrap gap-2 mb-8">
        {CATEGORIES.map((cat) => (
          <a
            key={cat}
            href={`#${cat.toLowerCase().replace(/ & /g, "-").replace(/ /g, "-")}`}
            className="px-3 py-1.5 rounded-md text-sm bg-parchment-dark text-bark-brown hover:bg-gnome-green/10 hover:text-gnome-green transition-colors"
          >
            {cat}
          </a>
        ))}
      </div>

      {/* Plugin sections */}
      {CATEGORIES.map((cat) => {
        const categoryPlugins = PLUGINS.filter((p) => p.category === cat);
        const anchorId = cat.toLowerCase().replace(/ & /g, "-").replace(/ /g, "-");

        return (
          <section key={cat} id={anchorId} className="mb-10 scroll-mt-20">
            <h2 className="font-display text-2xl text-bark-brown mb-4">{cat}</h2>
            <div className="space-y-3">
              {categoryPlugins.map((plugin) => (
                <Card key={plugin.name} hover={false}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-mono font-bold text-gnome-green">{plugin.name}</h3>
                        {plugin.hub && (
                          <span className="px-1.5 py-0.5 rounded bg-gnome-green/10 text-gnome-green text-xs font-semibold">
                            Hub
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-bark-brown-light">{plugin.description}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </section>
        );
      })}

      {/* Tip */}
      <Card hover={false} className="bg-parchment-dark mt-8">
        <h3 className="font-display text-lg text-bark-brown mb-2">Pro Tip</h3>
        <p className="text-sm text-bark-brown-light">
          Don&apos;t install every plugin at once — start with the Essentials category
          and add more as you need them. Too many plugins can clutter your screen
          and slow down the client. Ask in Discord if you need help configuring
          any plugin!
        </p>
      </Card>
    </div>
  );
}
