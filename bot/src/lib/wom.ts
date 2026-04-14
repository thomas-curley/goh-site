/**
 * Wise Old Man API wrapper for the bot.
 * Direct API calls (no @wise-old-man/utils dependency needed).
 */

const WOM_BASE = "https://api.wiseoldman.net/v2";
const GROUP_ID = process.env.WOM_GROUP_ID ?? "24582";

async function womFetch(path: string) {
  const res = await fetch(`${WOM_BASE}${path}`, {
    headers: { "User-Agent": "GnomeHome-Bot" },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function getPlayer(username: string) {
  return womFetch(`/players/${encodeURIComponent(username)}`);
}

export async function getPlayerGains(username: string, period: string = "week") {
  return womFetch(`/players/${encodeURIComponent(username)}/gained?period=${period}`);
}

export async function getPlayerKc(username: string) {
  return womFetch(`/players/${encodeURIComponent(username)}`);
}

export async function getGroupMembers() {
  return womFetch(`/groups/${GROUP_ID}`);
}

export function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

export function getCombatLevel(snapshot: Record<string, unknown>): number {
  const skills = (snapshot as { data?: { skills?: Record<string, { level: number }> } })?.data?.skills;
  if (!skills) return 3;

  const att = skills.attack?.level ?? 1;
  const str = skills.strength?.level ?? 1;
  const def = skills.defence?.level ?? 1;
  const hp = skills.hitpoints?.level ?? 10;
  const prayer = skills.prayer?.level ?? 1;
  const ranged = skills.ranged?.level ?? 1;
  const magic = skills.magic?.level ?? 1;

  const base = 0.25 * (def + hp + Math.floor(prayer / 2));
  const melee = 0.325 * (att + str);
  const range = 0.325 * (Math.floor(ranged / 2) + ranged);
  const mage = 0.325 * (Math.floor(magic / 2) + magic);

  return Math.floor(base + Math.max(melee, range, mage));
}

export const SKILL_ALIASES: Record<string, string> = {
  att: "attack", atk: "attack",
  str: "strength",
  def: "defence",
  hp: "hitpoints",
  range: "ranged", rng: "ranged",
  pray: "prayer",
  mage: "magic", mag: "magic",
  cook: "cooking",
  wc: "woodcutting", wood: "woodcutting",
  fletch: "fletching",
  fish: "fishing",
  fm: "firemaking",
  craft: "crafting",
  smith: "smithing",
  mine: "mining",
  herb: "herblore",
  agil: "agility", agi: "agility",
  thieve: "thieving", thief: "thieving",
  slay: "slayer",
  farm: "farming",
  rc: "runecrafting", rune: "runecrafting",
  hunt: "hunter",
  con: "construction", cons: "construction",
};

export function resolveSkill(input: string): string {
  const lower = input.toLowerCase();
  return SKILL_ALIASES[lower] ?? lower;
}
