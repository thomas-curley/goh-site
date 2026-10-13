// Shared (client + server) helpers for the member profiles beta.

export const EQUIPMENT_SLOTS = ["head", "cape", "neck", "ammo", "weapon", "body", "shield", "legs", "hands", "feet", "ring"] as const;
export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];

export const SLOT_LABELS: Record<EquipmentSlot, string> = {
  head: "Head",
  cape: "Cape",
  neck: "Neck",
  ammo: "Ammo",
  weapon: "Weapon",
  body: "Body",
  shield: "Shield",
  legs: "Legs",
  hands: "Hands",
  feet: "Feet",
  ring: "Ring",
};

export interface OutfitItem {
  /** OSRS Wiki item name, e.g. "Gnome goggles" -- also how the icon is found. */
  name: string;
}

export type Outfit = Partial<Record<EquipmentSlot, OutfitItem>>;

/** Keeps only known slots with a sensible item name. */
export function sanitizeOutfit(value: unknown): Outfit {
  const outfit: Outfit = {};
  if (!value || typeof value !== "object") return outfit;
  for (const slot of EQUIPMENT_SLOTS) {
    const raw = (value as Record<string, unknown>)[slot];
    const name = raw && typeof raw === "object" ? (raw as { name?: unknown }).name : undefined;
    if (typeof name === "string" && name.trim() && name.length <= 100) outfit[slot] = { name: name.trim() };
  }
  return outfit;
}

/** The item's inventory icon on the OSRS Wiki (file names use underscores for spaces). */
export function wikiItemIcon(name: string): string {
  return `https://oldschool.runescape.wiki/images/${encodeURIComponent(name.replace(/ /g, "_"))}.png`;
}

export function wikiItemPage(name: string): string {
  return `https://oldschool.runescape.wiki/w/${encodeURIComponent(name.replace(/ /g, "_"))}`;
}

/**
 * Colour tiers by clan percentile, after the "parse" colours on Warcraft
 * Logs / FF Logs: grey < 25 <= green < 50 <= blue < 75 <= purple < 95 <=
 * orange < 99 <= pink < 100 = gold (best in the clan).
 */
export interface ParseTier {
  label: string;
  bg: string;
  fg: string;
}

const TIERS: { min: number; tier: ParseTier }[] = [
  { min: 100, tier: { label: "Best in clan", bg: "#e5cc80", fg: "#3b2f05" } },
  { min: 99, tier: { label: "Top 1%", bg: "#e268a8", fg: "#ffffff" } },
  { min: 95, tier: { label: "Top 5%", bg: "#ff8000", fg: "#1f1000" } },
  { min: 75, tier: { label: "Top 25%", bg: "#a335ee", fg: "#ffffff" } },
  { min: 50, tier: { label: "Top half", bg: "#0070dd", fg: "#ffffff" } },
  { min: 25, tier: { label: "Lower half", bg: "#1eaa3a", fg: "#ffffff" } },
  { min: 0, tier: { label: "Bottom 25%", bg: "#6b6b6b", fg: "#ffffff" } },
];

/** 100 for 1st place, 0 for last; a lone ranked member is 100. */
export function clanPercentile(rank: number, count: number): number {
  if (count <= 1) return 100;
  return Math.round(((count - rank) / (count - 1)) * 100);
}

export function parseTier(percentile: number): ParseTier {
  return (TIERS.find((t) => percentile >= t.min) ?? TIERS[TIERS.length - 1]).tier;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}
