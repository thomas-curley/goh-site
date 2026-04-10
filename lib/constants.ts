export const WOM_GROUP_ID = 24582;
export const WOM_BASE_URL = "https://api.wiseoldman.net/v2";
export const WOM_GROUP_URL = `https://wiseoldman.net/groups/${WOM_GROUP_ID}`;
export const CLAN_NAME = "Gn0me Home";
export const CLAN_CHAT = "Gn0me Home";
export const DISCORD_INVITE = "https://discord.gg/gnomehome"; // Update with actual invite link

export const RANKS = [
  { name: "Gnome Child", order: 0, color: "bg-green-300 text-green-900", key: "gnome_child" },
  { name: "Oak", order: 1, color: "bg-amber-700 text-amber-100", key: "oak" },
  { name: "Pine", order: 2, color: "bg-green-700 text-green-100", key: "pine" },
  { name: "Yew", order: 3, color: "bg-green-900 text-green-100", key: "yew" },
  { name: "Council Member", order: 4, color: "bg-yellow-500 text-yellow-900", key: "council_member" },
] as const;

export type RankName = (typeof RANKS)[number]["name"];

// WOM roles that map to "Council Member" (highest rank)
const COUNCIL_ALIASES = ["owner", "summoner", "council", "council_member", "summoner_hat", "leader", "administrator"];

export function getRankByName(name: string) {
  const normalized = name.toLowerCase().replace(/ /g, "_");

  // Map WOM owner/summoner/council to Council Member
  if (COUNCIL_ALIASES.includes(normalized)) {
    return RANKS.find((r) => r.key === "council_member");
  }

  return RANKS.find(
    (r) => r.name.toLowerCase() === name.toLowerCase() || r.key === normalized
  );
}

export function getRankOrder(name: string): number {
  return getRankByName(name)?.order ?? -1;
}

export const EVENT_TYPES = [
  { name: "PvM", color: "#8B1A1A", key: "pvm" },
  { name: "Skilling Competition", color: "#2D5016", key: "skilling" },
  { name: "Drop Party", color: "#DAA520", key: "drop_party" },
  { name: "Hide & Seek", color: "#4A7C23", key: "hide_seek" },
  { name: "Social", color: "#3E2B1C", key: "social" },
  { name: "Other", color: "#6B6B6B", key: "other" },
] as const;

export const OWNER_TOOLS = [
  { name: "Clan Armory", url: "https://clan-armory.com" },
  { name: "Old School Armoury", url: "https://oldschoolarmoury.com" },
  { name: "Gnome Banking", url: "https://gnome-banking.com" },
] as const;

export const SKILLS_ORDER = [
  "attack", "hitpoints", "mining",
  "strength", "agility", "smithing",
  "defence", "herblore", "fishing",
  "ranged", "thieving", "cooking",
  "prayer", "crafting", "firemaking",
  "magic", "fletching", "woodcutting",
  "runecrafting", "slayer", "farming",
  "construction", "hunter", "overall",
] as const;
