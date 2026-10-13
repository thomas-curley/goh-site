// Shared (client + server) model of a member's OSRS character: their look
// (body type, body-part styles, colours) and the gear they wear. The game
// data lives in public/osrs, built from the OSRS cache by
// scripts/osrs-models (see .github/workflows/osrs-models.yml).

import { EQUIPMENT_SLOTS, type EquipmentSlot } from "@/lib/profiles-format";

export const OSRS_DATA_URL = "/osrs";

/** OSRS equipment slot ids, as stored in items.json `slot`. */
export const SLOT_IDS: Record<EquipmentSlot, number> = {
  head: 0,
  cape: 1,
  neck: 2,
  weapon: 3,
  body: 4,
  shield: 5,
  legs: 7,
  hands: 9,
  feet: 10,
  ring: 12,
  ammo: 13,
};

export const SLOT_BY_ID: Record<number, EquipmentSlot> = Object.fromEntries(
  EQUIPMENT_SLOTS.map((s) => [SLOT_IDS[s], s]),
) as Record<number, EquipmentSlot>;

/** Body parts in kit order; `part` in kits.json is this index (+7 for the female body). */
export const BODY_PARTS = ["Hair", "Jaw", "Torso", "Arms", "Hands", "Legs", "Feet"] as const;
/** Equipment slot each body part is drawn in, as the game does it. */
export const BODY_PART_SLOTS = [8, 11, 4, 6, 9, 7, 10];

export const COLOUR_LABELS = ["Hair", "Torso", "Legs", "Feet", "Skin"] as const;

// The game's player recolour tables: colour slot i turns every face coloured
// FIND[i] into REPLACE[i][choice] (and FIND2[i] into REPLACE2[i][choice]).
const FIND = [6798, 8741, 25238, 4626, 4550];
const REPLACE: number[][] = [
  [6798, 107, 10283, 16, 4797, 7744, 5799, 4634, -31839, 22433, 2983, -11343, 8, 5281, 10438, 3650, -27322, -21845, 200, 571, 908, 21830, 28946, -15701, -14010],
  [8741, 12, -1506, -22374, 7735, 8404, 1701, -27106, 24094, 10153, -8915, 4783, 1341, 16578, -30533, 25239, 8, 5281, 10438, 3650, -27322, -21845, 200, 571, 908, 21830, 28946, -15701, -14010],
  [25238, 8742, 12, -1506, -22374, 7735, 8404, 1701, -27106, 24094, 10153, -8915, 4783, 1341, 16578, -30533, 8, 5281, 10438, 3650, -27322, -21845, 200, 571, 908, 21830, 28946, -15701, -14010],
  [4626, 11146, 6439, 12, 4758, 10270],
  [4550, 4537, 5681, 5673, 5790, 6806, 8076, 4574, 17050, 0, 127, -31821, -17991],
];
const FIND2 = [-10304, 9104, -1, -1, -1];
const REPLACE2: number[][] = [
  [6554, 115, 10304, 28, 5702, 7756, 5681, 4510, -31835, 22437, 2859, -11339, 16, 5157, 10446, 3658, -27314, -21965, 472, 580, 784, 21966, 28950, -15697, -14002],
  [9104, 10275, 7595, 3610, 7975, 8526, 918, -26734, 24466, 10145, -6882, 5027, 1457, 16565, -30545, 25486, 24, 5392, 10429, 3673, -27335, -21957, 192, 687, 412, 21821, 28835, -15460, -14019],
  [],
  [],
  [],
];

/** How many choices each colour slot has. */
export const COLOUR_COUNTS = REPLACE.map((r) => r.length);

/** Representative HSL colour of each choice, for swatches. */
export function colourSwatch(slot: number, choice: number): number {
  return REPLACE[slot][choice] & 0xffff;
}

export interface CharacterLook {
  female: boolean;
  /** Kit id for each body part (BODY_PARTS order); -1 = none. */
  kits: number[];
  /** Choice for each colour slot (COLOUR_LABELS order). */
  colours: number[];
}

export interface GearItem {
  /** OSRS item id. */
  id: number;
  name: string;
}

export type CharacterGear = Partial<Record<EquipmentSlot, GearItem>>;

export interface Character {
  look: CharacterLook;
  gear: CharacterGear;
}

export const DEFAULT_KITS = {
  male: [0, 10, 18, 26, 33, 36, 42],
  female: [45, -1, 56, 61, 67, 70, 79],
};

export function defaultLook(female = false): CharacterLook {
  return { female, kits: [...(female ? DEFAULT_KITS.female : DEFAULT_KITS.male)], colours: [0, 0, 0, 0, 0] };
}

function int(v: unknown, min: number, max: number): number | null {
  return typeof v === "number" && Number.isInteger(v) && v >= min && v <= max ? v : null;
}

export function sanitizeLook(value: unknown): CharacterLook | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const female = v.female === true;
  const base = defaultLook(female);
  const kits = Array.isArray(v.kits) ? v.kits : [];
  const colours = Array.isArray(v.colours) ? v.colours : [];
  return {
    female,
    kits: base.kits.map((d, i) => int(kits[i], -1, 9999) ?? d),
    colours: base.colours.map((d, i) => int(colours[i], 0, COLOUR_COUNTS[i] - 1) ?? d),
  };
}

export function sanitizeGear(value: unknown): CharacterGear {
  const gear: CharacterGear = {};
  if (!value || typeof value !== "object") return gear;
  for (const slot of EQUIPMENT_SLOTS) {
    const raw = (value as Record<string, unknown>)[slot];
    if (!raw || typeof raw !== "object") continue;
    const id = int((raw as { id?: unknown }).id, 0, 1_000_000);
    const name = (raw as { name?: unknown }).name;
    if (id !== null && typeof name === "string" && name.trim() && name.length <= 100) gear[slot] = { id, name: name.trim() };
  }
  return gear;
}

// ── Game data (public/osrs) ─────────────────────────────────────────────

export interface OsrsItem {
  id: number;
  name: string;
  slot: number;
  /** Other slots this item hides, e.g. a full helm hides hair (8) and jaw (11). */
  hide?: number[];
  m: number[];
  f: number[];
  mo?: number;
  fo?: number;
  rf?: number[];
  rr?: number[];
  tf?: number[];
  tr?: number[];
}

export interface OsrsKit {
  id: number;
  part: number;
  models: number[];
  hidden?: boolean;
  rf?: number[];
  rr?: number[];
}

/** One model to draw, with the recolours that apply to it. */
export interface ModelPart {
  model: number;
  /** Vertical offset (game units, + is down). */
  offsetY: number;
  recolour: Map<number, number>;
  retexture: Map<number, number>;
}

function pairs(find?: number[], replace?: number[]): Map<number, number> {
  const map = new Map<number, number>();
  if (find && replace) find.forEach((f, i) => map.set(f & 0xffff, replace[i] & 0xffff));
  return map;
}

/** The player's colour recolours, applied after each part's own. */
export function playerRecolours(look: CharacterLook): Map<number, number> {
  const map = new Map<number, number>();
  look.colours.forEach((choice, i) => {
    if (choice < REPLACE[i].length) map.set(FIND[i] & 0xffff, REPLACE[i][choice] & 0xffff);
    if (FIND2[i] !== -1 && choice < REPLACE2[i].length) map.set(FIND2[i] & 0xffff, REPLACE2[i][choice] & 0xffff);
  });
  return map;
}

/**
 * Works out which models make up the player, the way the game does: worn
 * items fill their slots and hide others (a full helm hides hair and beard),
 * and the body-part kits fill whatever is left.
 */
export function composeCharacter(
  look: CharacterLook,
  gearIds: number[],
  items: Map<number, OsrsItem>,
  kits: Map<number, OsrsKit>,
): ModelPart[] {
  const worn = gearIds.map((id) => items.get(id)).filter((it): it is OsrsItem => !!it);
  const hidden = new Set<number>();
  for (const it of worn) for (const s of it.hide ?? []) hidden.add(s);

  const bySlot = new Map<number, OsrsItem>();
  for (const it of worn) if (!hidden.has(it.slot)) bySlot.set(it.slot, it);

  const parts: ModelPart[] = [];
  BODY_PART_SLOTS.forEach((slot, part) => {
    if (bySlot.has(slot) || hidden.has(slot)) return;
    const kit = kits.get(look.kits[part]);
    if (!kit) return;
    for (const model of kit.models) parts.push({ model, offsetY: 0, recolour: pairs(kit.rf, kit.rr), retexture: new Map() });
  });
  for (const it of bySlot.values()) {
    const models = look.female ? it.f : it.m;
    const offsetY = (look.female ? it.fo : it.mo) ?? 0;
    for (const model of models) parts.push({ model, offsetY, recolour: pairs(it.rf, it.rr), retexture: pairs(it.tf, it.tr) });
  }
  return parts;
}

/** Selectable kits for a body part, for the current body type. */
export function kitOptions(kits: OsrsKit[], part: number, female: boolean): OsrsKit[] {
  return kits.filter((k) => !k.hidden && k.part === part + (female ? 7 : 0));
}

// ── Colours ─────────────────────────────────────────────────────────────

/** OSRS 16-bit HSL to an sRGB [r, g, b] in 0..1, with the game's default brightness. */
export function hslToRgb(hsl: number, brightness = 0.6): [number, number, number] {
  const hue = ((hsl >> 10) & 63) / 64 + 0.5 / 64;
  const sat = ((hsl >> 7) & 7) / 8 + 0.5 / 8;
  const lum = (hsl & 127) / 128;
  const chroma = (1 - Math.abs(2 * lum - 1)) * sat;
  const x = chroma * (1 - Math.abs(((hue * 6) % 2) - 1));
  const m = lum - chroma / 2;
  let r = m;
  let g = m;
  let b = m;
  switch (Math.floor(hue * 6)) {
    case 0:
      r += chroma;
      g += x;
      break;
    case 1:
      g += chroma;
      r += x;
      break;
    case 2:
      g += chroma;
      b += x;
      break;
    case 3:
      b += chroma;
      g += x;
      break;
    case 4:
      b += chroma;
      r += x;
      break;
    default:
      r += chroma;
      b += x;
  }
  return [r, g, b].map((c) => Math.pow(Math.min(Math.max(c, 0), 1), brightness)) as [number, number, number];
}

export function hslToCss(hsl: number): string {
  const [r, g, b] = hslToRgb(hsl);
  return `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})`;
}

/** Item icon by id (RuneLite's item icon cache). */
export function itemIconUrl(id: number): string {
  return `https://static.runelite.net/cache/item/icon/${id}.png`;
}
