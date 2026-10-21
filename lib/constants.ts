export const WOM_GROUP_ID = 24582;
export const WOM_BASE_URL = "https://api.wiseoldman.net/v2";
export const WOM_GROUP_URL = `https://wiseoldman.net/groups/${WOM_GROUP_ID}`;
export const CLAN_NAME = "Gn0me Home";
export const CLAN_CHAT = "Gn0me Home";
// Used to format event dates/times in server-rendered text (Discord posts, the
// homepage) so they show the clan's actual local time rather than whatever
// timezone the server process happens to run in (UTC on Vercel).
export const CLAN_TIMEZONE = "America/New_York";
export const DISCORD_INVITE = "https://discord.gg/F392pAMCvA";

// The clan's ranks, lowest to highest. Gold Key and Silver Key are the
// in-game Owner and Deputy Owner ranks (their key icons), as Wise Old Man
// shows them; Council is the Summoner rank and sits below Oak.
export const RANKS = [
  { name: "Gnome Child", order: 0, color: "bg-green-300 text-green-900", key: "gnome_child" },
  { name: "Council", order: 1, color: "bg-sky-700 text-sky-50", key: "council" },
  { name: "Oak", order: 2, color: "bg-amber-700 text-amber-100", key: "oak" },
  { name: "Pine", order: 3, color: "bg-green-700 text-green-100", key: "pine" },
  { name: "Yew", order: 4, color: "bg-green-900 text-green-100", key: "yew" },
  { name: "Silver Key", order: 5, color: "bg-slate-300 text-slate-900", key: "silver_key" },
  { name: "Gold Key", order: 6, color: "bg-yellow-500 text-yellow-950", key: "gold_key" },
] as const;

export type RankName = (typeof RANKS)[number]["name"];
export type RankKey = (typeof RANKS)[number]["key"];

/** The lowest rank that counts as staff (Council and above). */
export const STAFF_MIN_ORDER = 1;

// Wise Old Man role names (and older names this site used) -> our rank keys.
export const ROLE_ALIASES: Record<string, RankKey> = {
  owner: "gold_key",
  gold_key: "gold_key",
  deputy_owner: "silver_key",
  silver_key: "silver_key",
  summoner: "council",
  summoner_hat: "council",
  council: "council",
  council_member: "council",
  leader: "council",
  administrator: "council",
};

/** A Wise Old Man role (or rank name) as our rank key, e.g. "deputy_owner" -> "silver_key". */
export function rankKeyFor(name: string): string {
  const normalized = name.toLowerCase().trim().replace(/[\s-]+/g, "_");
  return ROLE_ALIASES[normalized] ?? normalized;
}

export function getRankByName(name: string) {
  const key = rankKeyFor(name);
  return RANKS.find((r) => r.key === key || r.name.toLowerCase() === name.toLowerCase());
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
