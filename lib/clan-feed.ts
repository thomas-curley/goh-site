import { QUESTS } from "@/lib/quests";

// Reading the clan feed: Discord posts from DropTracker or a clan-chat
// forwarder, turned into drops, collection log items, pets and quest
// completions. Pure functions, shared by the bot endpoint and the admin
// "try a message" box.

export interface FeedEmbed {
  authorName?: string | null;
  title?: string | null;
  description?: string | null;
  fields?: { name: string; value: string }[];
  footer?: string | null;
  imageUrl?: string | null;
  thumbnailUrl?: string | null;
}

export interface FeedMessage {
  messageId: string;
  channelId: string;
  authorName: string | null;
  postedAt: string;
  content: string;
  embeds: FeedEmbed[];
  attachmentUrls: string[];
}

export type FeedEventKind = "drop" | "collection_log" | "pet" | "quest";

export interface FeedEvent {
  kind: FeedEventKind;
  rsn: string;
  /** The item (drop, collection log, pet) or quest name, as written. */
  name: string;
  quantity: number;
}

/** Markdown, links, custom emoji and HTML-ish colour tags stripped, whitespace collapsed. */
export function cleanText(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/<a?:\w+:\d+>/g, "") // custom emoji
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // [text](url)
    .replace(/<\/?col(?:=[0-9a-f]+)?>/gi, "") // in-game colour tags
    .replace(/<img=\d+>/gi, "") // in-game rank icons
    .replace(/(\*\*|__|~~|`|\*|\|\|)/g, "")
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, "") // emoji
    .replace(/[ \t ]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim();
}

/** Matches RSNs the way the game does: case, spaces, underscores and hyphens don't matter. */
export function rsnKey(rsn: string): string {
  return rsn.toLowerCase().replace(/[\s_\- ]+/g, " ").trim();
}

/** Loose key for item and quest names: lower case, letters and digits only. */
export function nameKey(name: string): string {
  return name.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
}

const QUEST_BY_KEY = new Map(QUESTS.map((q) => [nameKey(q.name), q.name]));
// In-game broadcasts write Recipe for Disaster's parts with a slash.
for (const q of QUESTS) if (q.name.includes(" - ")) QUEST_BY_KEY.set(nameKey(q.name.replace(" - ", "/")), q.name);

/** The quest list's name for a quest as written in a post, or null if it isn't one. */
export function matchQuest(written: string): string | null {
  const key = nameKey(written.replace(/^the quest\s+/i, "").replace(/\bfreeing\s+/i, ""));
  const exact = QUEST_BY_KEY.get(key);
  if (exact) return exact;
  // A shortened name ("Desert Treasure II" for "... - The Fallen Empire"),
  // but only when exactly one quest fits.
  if (key.length < 6) return null;
  const fits = [...new Set([...QUEST_BY_KEY.entries()].filter(([k]) => k.startsWith(key)).map(([, name]) => name))];
  return fits.length === 1 ? fits[0] : null;
}

const RSN = String.raw`([A-Za-z0-9][A-Za-z0-9 _\-]{0,11})`;
const strip = (s: string) => s.replace(/^\[[^\]]+\]\s*/, "").trim(); // "[Clan] " prefix on broadcasts

// "Name received a drop: 2 x Item (1,234 coins)." and friends, as the game
// broadcasts them in clan chat (and clan-chat forwarders repost them).
const LINE_PATTERNS: { kind: FeedEventKind; re: RegExp }[] = [
  { kind: "quest", re: new RegExp(`^${RSN} has completed (?:a quest|the quest)[:\\s]+(.+?)[.!]?$`, "i") },
  { kind: "drop", re: new RegExp(`^${RSN} received (?:a drop|special loot from a raid|a clue item)[:\\s]+(.+?)[.!]?$`, "i") },
  { kind: "collection_log", re: new RegExp(`^${RSN} received a new collection log item[:\\s]+(.+?)[.!]?$`, "i") },
  { kind: "pet", re: new RegExp(`^${RSN} (?:has a funny feeling like (?:he|she|they|you)(?:'s| is| are|'re) being followed|feels something weird sneaking into (?:his|her|their|your) backpack)[:\\s]+(.+?)[.!]?$`, "i") },
];

// "Name received a drop:" with the item in the embed's title (DropTracker).
const HEADER_PATTERNS: { kind: FeedEventKind; re: RegExp }[] = [
  { kind: "drop", re: new RegExp(`^${RSN} (?:received a drop|received special loot|received a clue item|has received)\\s*:?$`, "i") },
  { kind: "collection_log", re: new RegExp(`^${RSN} (?:received a new collection log item|has a new collection log item|added an item to (?:their|his|her) collection log)\\s*:?$`, "i") },
  { kind: "pet", re: new RegExp(`^${RSN} (?:received a pet|got a pet|has a new pet|has a funny feeling.*)\\s*:?$`, "i") },
  { kind: "quest", re: new RegExp(`^${RSN} (?:has completed a quest|completed a quest|has completed)\\s*:?$`, "i") },
];

/** "2 x Item", "Item x 2" and "(670 x 190)" (DropTracker's quantity x price). */
function splitQuantity(item: string): { name: string; quantity: number } {
  let m = item.match(/^([\d,]+)\s*x\s+(.+)$/i);
  if (m) return { name: m[2].trim(), quantity: Number(m[1].replace(/,/g, "")) || 1 };
  m = item.match(/^(.+?)\s+x\s*([\d,]+)$/i);
  if (m) return { name: m[1].trim(), quantity: Number(m[2].replace(/,/g, "")) || 1 };
  return { name: item.trim(), quantity: 1 };
}

function tidyName(name: string): string {
  return name
    .replace(/\s*\((?:[\d,.]+\s*(?:coins|gp)|\d+\/\d+)\)\s*$/i, "") // (1,234 coins) or (12/1477)
    .replace(/\s+at\s+[\d,]+\s+\w+(?:\s+\w+)?\s*$/i, "") // pet "at 500 killcount"
    .replace(/[.!]+$/, "")
    .trim();
}

/** What a DropTracker-style embed title says the post is about. */
function embedKind(title: string): FeedEventKind | null {
  if (/quest/i.test(title)) return "quest";
  if (/collection log/i.test(title)) return "collection_log";
  if (/\bpet\b/i.test(title)) return "pet";
  if (/\b(drop|loot)\b/i.test(title)) return "drop";
  return null;
}

/** Every event a post describes (usually one). */
export function parseFeedMessage(msg: Pick<FeedMessage, "content" | "embeds">): FeedEvent[] {
  const events: FeedEvent[] = [];
  const push = (kind: FeedEventKind, rsn: string, rawName: string, quantity = 1) => {
    const split = splitQuantity(tidyName(rawName));
    const name = split.name;
    if (!name || !rsn.trim()) return;
    const q = split.quantity > 1 ? split.quantity : quantity;
    if (events.some((e) => e.kind === kind && rsnKey(e.rsn) === rsnKey(rsn) && nameKey(e.name) === nameKey(name))) return;
    events.push({ kind, rsn: rsn.trim(), name, quantity: Math.max(1, Math.min(100000, q)) });
  };

  const content = cleanText(msg.content);
  const embeds = msg.embeds.map((e) => ({
    author: cleanText(e.authorName),
    title: cleanText(e.title),
    description: cleanText(e.description),
    fields: (e.fields ?? []).map((f) => ({ name: cleanText(f.name).toLowerCase(), value: cleanText(f.value) })),
  }));

  // 1. Full broadcast lines anywhere in the post.
  const lines = [content, ...embeds.flatMap((e) => [e.author, e.title, e.description])].flatMap((t) => t.split("\n")).map(strip).filter(Boolean);
  for (const line of lines) {
    for (const p of LINE_PATTERNS) {
      const m = line.match(p.re);
      if (m) push(p.kind, m[1], m[2]);
    }
  }
  if (events.length) return events;

  // 2. DropTracker's own embeds: "Name completed **Quest**." under a "Quest
  //    Completed" title, and "Name received **Item**." style lines whose kind
  //    comes from the title. A quest only counts if it's a real quest name.
  for (const e of embeds) {
    const kind = embedKind(e.title);
    for (const line of [e.description, e.author, content].flatMap((t) => t.split("\n")).map(strip)) {
      let m = line.match(new RegExp(`^${RSN} (?:has )?completed (?:the quest |a quest:? )?(.+?)[.!]?$`, "i"));
      if (m && matchQuest(m[2])) push("quest", m[1], m[2]);
      m = line.match(new RegExp(`^${RSN} (?:has )?(?:received|obtained|got|found) (?:a |an |the )?(?:new )?(?:drop|pet|collection log item)?[:\\s]*(.+?)[.!]?$`, "i"));
      if (m && kind && kind !== "quest") push(kind, m[1], m[2]);
    }
  }
  if (events.length) return events;

  // 3. A "Name received a drop:" header with the item as the embed title
  //    (DropTracker). Its description may hold "G/E Value: 127.30K (670 x 190)".
  const headers = [content, ...embeds.map((e) => e.author)].flatMap((t) => t.split("\n")).map(strip);
  for (const header of headers) {
    for (const p of HEADER_PATTERNS) {
      const m = header.match(p.re);
      if (!m) continue;
      for (const e of embeds) {
        if (!e.title) continue;
        const qty = e.description.match(/\(\s*([\d,]+)\s*x\s*[\d,.]+\s*[kmb]?\s*\)/i);
        push(p.kind, m[1], e.title, qty ? Number(qty[1].replace(/,/g, "")) : 1);
      }
    }
  }
  if (events.length) return events;

  // 4. Embeds that label things in fields: Player / Quest / Item.
  for (const e of embeds) {
    const field = (...names: string[]) => e.fields.find((f) => names.includes(f.name))?.value ?? "";
    const rsn = field("player", "rsn", "name", "username", "account") || e.author;
    if (!rsn || rsn.length > 12) continue;
    const quest = field("quest", "quest name", "quest completed");
    if (quest) push("quest", rsn, quest);
    const item = field("item", "drop", "loot", "item name");
    if (item) push(/collection log/i.test(`${e.title} ${e.description}`) ? "collection_log" : "drop", rsn, item);
  }
  return events;
}

/** All the text of a post, as stored in the feed log. */
export function feedText(msg: Pick<FeedMessage, "content" | "embeds">): string {
  return [
    msg.content,
    ...msg.embeds.flatMap((e) => [e.authorName, e.title, e.description, ...(e.fields ?? []).map((f) => `${f.name}: ${f.value}`), e.footer]),
  ]
    .filter((s): s is string => !!s && !!s.trim())
    .join("\n")
    .slice(0, 4000);
}
