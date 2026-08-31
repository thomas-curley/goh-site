// Medieval/RuneScape-themed word bank for randomly generated event check-in
// codes -- 5-7 letters each, real recognizable words so they're easy to
// announce and spell out loud. Mixes actual OSRS terminology (bosses, gear,
// locations) with general medieval/fantasy vocabulary.
export const CHECKIN_WORDS = [
  "abbey", "accord", "agility", "akkha", "almanac", "altar", "ambush", "ancient",
  "angel", "arceuus", "archer", "armor", "armory", "arsenal", "attack", "auburn",
  "bandit", "banner", "banshee", "baron", "barrow", "barrows", "battle", "bequest",
  "blessed", "boots", "brawler", "burrow", "candle", "canifis", "caravan", "caravel",
  "cassock", "castle", "censer", "chamber", "chariot", "chimera", "circlet", "cleric",
  "cloak", "cobalt", "codex", "compass", "consort", "consul", "cooking", "copper",
  "count", "courier", "courser", "crimson", "crown", "crypt", "curse", "cyclops",
  "dagger", "dagon", "dancer", "defence", "desert", "destiny", "dharok", "diadem",
  "dinghy", "divine", "dowry", "dragon", "druid", "drummer", "duelist", "elite",
  "emblem", "emerald", "empire", "enchant", "envoy", "eternal", "fairy", "falador",
  "falcon", "farmer", "farming", "feldip", "fighter", "filly", "fishing", "forge",
  "fortune", "foundry", "frigate", "gallows", "galvek", "garnet", "ghost", "giant",
  "gibbet", "girdle", "glacier", "gloom", "glory", "gloves", "gnome", "gorget",
  "granite", "grave", "greaves", "grotto", "grove", "gwenith", "halberd", "heath",
  "hoards", "hound", "hunter", "hydra", "jasper", "jelly", "jerkin", "jester",
  "jewels", "jungle", "karamja", "karuulm", "kephri", "knight", "kourend", "kraken",
  "lantern", "ledger", "legacy", "legate", "legend", "longbow", "magic", "maiden",
  "mantle", "marble", "market", "maroon", "marsh", "marshal", "masori", "mastiff",
  "meadow", "melee", "menhir", "mining", "mitre", "monarch", "mystic", "nylocas",
  "oasis", "occult", "orchard", "ossuary", "outlaw", "paladin", "palfrey", "pasture",
  "peasant", "pegasus", "pendant", "pennant", "phantom", "phoenix", "pillage", "pillory",
  "pirate", "pixie", "pledge", "plunder", "potion", "pouch", "prayer", "priory",
  "pyramid", "quarry", "quartz", "queen", "quest", "rampart", "ranged", "ransom",
  "ravine", "riches", "rogue", "runes", "sabaton", "sacred", "sailor", "sanctum",
  "scepter", "scorpia", "scribe", "scroll", "scuffle", "sentry", "sextant", "shaft",
  "sheath", "sheriff", "shield", "shrine", "siege", "sigil", "siren", "slayer",
  "sledge", "smithy", "soldier", "somber", "sortie", "spectre", "spinel", "spirit",
  "staff", "stave", "staves", "steed", "steel", "steward", "stocks", "stole",
  "sundial", "suqah", "surcoat", "tabard", "tablet", "tariff", "tavern", "tithe",
  "torch", "totems", "tourney", "tower", "trader", "tribute", "tumeken", "tumulus",
  "tundra", "unholy", "vampire", "varrock", "vellum", "vendor", "verzik", "virtus",
  "visage", "vorkath", "warfare", "warren", "whisper", "wimple", "witch", "wizard",
  "xarpus", "zanaris", "zombie", "zulrah",
] as const;

export function randomCheckInWord(): string {
  return CHECKIN_WORDS[Math.floor(Math.random() * CHECKIN_WORDS.length)];
}
