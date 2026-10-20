// Builds content/osrs-quests.json (every quest and miniquest with its
// difficulty, quest points, members flag and series) from the OSRS Wiki's
// Quests/List page, and checks the names against live WikiSync data for a
// few players so quest events can match the two exactly.
//
//   node build.mjs <out.json>        (SAMPLE_RSNS="A,B" to choose players)
//
// No dependencies; needs Node 20+ for fetch. Run by
// .github/workflows/osrs-quests.yml because the wiki isn't reachable from
// every environment.

import { writeFileSync } from "node:fs";

const UA = "GnomeHomeClanSite/1.0 (quest events; https://gn0mehome.com)";
const out = process.argv[2] ?? "osrs-quests.json";
const sampleRsns = (process.env.SAMPLE_RSNS ?? "Gn0me Vlad,Um3ra,Gn0me Sammi").split(",").map((s) => s.trim()).filter(Boolean);

const DIFFICULTIES = ["Novice", "Intermediate", "Experienced", "Master", "Grandmaster", "Special"];
// Checked longest first, since "Grandmaster" contains "Master".
const DIFFICULTY_MATCH = [...DIFFICULTIES].sort((a, b) => b.length - a.length);

// WikiSync's names for quests the wiki list names differently. Quest events
// use WikiSync's names so completions match exactly.
const WIKISYNC_NAME = {
  "Recipe for Disaster/Another Cook's Quest": "Recipe for Disaster - Another Cook's Quest",
  "Recipe for Disaster/Defeating the Culinaromancer": "Recipe for Disaster - Culinaromancer",
  "Recipe for Disaster/Freeing Evil Dave": "Recipe for Disaster - Evil Dave",
  "Recipe for Disaster/Freeing King Awowogei": "Recipe for Disaster - King Awowogei",
  "Recipe for Disaster/Freeing Pirate Pete": "Recipe for Disaster - Pirate Pete",
  "Recipe for Disaster/Freeing Sir Amik Varze": "Recipe for Disaster - Sir Amik Varze",
  "Recipe for Disaster/Freeing Skrach Uglogwee": "Recipe for Disaster - Skrach Uglogwee",
  "Recipe for Disaster/Freeing the Goblin generals": "Recipe for Disaster - Wartface & Bentnoze",
  "Recipe for Disaster/Freeing the Lumbridge Guide": "Recipe for Disaster - Lumbridge Guide",
  "Recipe for Disaster/Freeing the Mountain Dwarf": "Recipe for Disaster - Mountain Dwarf",
};
// Keys WikiSync sends that aren't quests.
const WIKISYNC_IGNORE = new Set(["."]);

const decode = (s) =>
  s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
const text = (html) => decode(html.replace(/<sup[\s\S]*?<\/sup>/g, "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

async function wikiHtml(page) {
  const url = `https://oldschool.runescape.wiki/api.php?action=parse&page=${encodeURIComponent(page)}&prop=text&format=json&formatversion=2`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Wiki ${page}: HTTP ${res.status}`);
  const json = await res.json();
  return json.parse.text;
}

/** Every wikitable on the page with the heading above it, header names and rows (as raw cell HTML). */
function tables(html) {
  const result = [];
  const re = /<h[23][^>]*>([\s\S]*?)<\/h[23]>|<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>([\s\S]*?)<\/table>/g;
  let heading = "";
  for (const m of html.matchAll(re)) {
    if (m[1] !== undefined) {
      heading = text(m[1]);
      continue;
    }
    const rows = [...m[2].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => [...r[1].matchAll(/<(t[hd])([^>]*)>([\s\S]*?)<\/t[hd]>/g)].map((c) => ({ tag: c[1], attrs: c[2], html: c[3] })));
    const headerRow = rows.find((r) => r.length && r.every((c) => c.tag === "th"));
    if (!headerRow) continue;
    result.push({ heading, headers: headerRow.map((c) => text(c.html)), rows: rows.filter((r) => r.some((c) => c.tag === "td")) });
  }
  return result;
}

function nameFrom(cellHtml) {
  const link = cellHtml.match(/<a [^>]*title="([^"]+)"[^>]*>/);
  return decode(link ? link[1] : text(cellHtml)).replace(/ \(quest\)$/i, "").trim();
}

const html = await wikiHtml("Quests/List");
const found = tables(html);
console.log(`Found ${found.length} tables on Quests/List:`);
for (const t of found) console.log(`  [${t.heading}] ${t.rows.length} rows · columns: ${t.headers.join(" | ")}`);

const quests = new Map();
for (const t of found) {
  const h = t.headers.map((x) => x.toLowerCase());
  const col = (re) => h.findIndex((x) => re.test(x));
  const iName = col(/^(name|quest|miniquest)/);
  const iDiff = col(/difficulty/);
  // The quest points column has an icon for a header, so its text is empty.
  const iQp = col(/quest points|^qp$|points/) >= 0 ? col(/quest points|^qp$|points/) : h.findIndex((x) => x === "");
  const iSeries = col(/series/);
  const iLength = col(/length/);
  const iMembers = col(/members/);
  if (iName < 0 || iDiff < 0) continue;
  const heading = t.heading.toLowerCase();
  const miniquest = /miniquest/.test(heading) || h[iName].startsWith("miniquest");
  for (const r of t.rows) {
    // Rows can start with a <th> (e.g. a release number), so line cells up by position from the header.
    if (r.length < t.headers.length) continue;
    const wikiName = nameFrom(r[iName].html);
    const name = WIKISYNC_NAME[wikiName] ?? wikiName.replace(/ \(miniquest\)$/i, "");
    if (!name || quests.has(name)) continue;
    const diff = DIFFICULTY_MATCH.find((d) => text(r[iDiff].html).toLowerCase().includes(d.toLowerCase())) ?? "Special";
    const qp = iQp >= 0 ? Number(text(r[iQp].html).replace(/[^\d]/g, "")) || 0 : 0;
    const membersCell = iMembers >= 0 ? text(r[iMembers].html).toLowerCase() : "";
    const series = iSeries >= 0 ? text(r[iSeries].html).replace(/\s+,/g, ",").replace(/,\s*#/, " #") : "";
    quests.set(name, {
      name,
      wikiPage: wikiName,
      difficulty: diff,
      qp,
      members: iMembers >= 0 ? /yes|members|✓/.test(membersCell) || r[iMembers].html.includes("Member") : !/free/.test(heading),
      miniquest,
      length: iLength >= 0 ? text(r[iLength].html) : null,
      series: series && series !== "N/A" ? series : null,
    });
  }
}

const list = [...quests.values()].sort((a, b) => a.name.localeCompare(b.name));
console.log(`\nParsed ${list.length} quests (${list.filter((q) => q.miniquest).length} miniquests, ${list.filter((q) => !q.members).length} free-to-play).`);
console.log("By difficulty:", JSON.stringify(Object.fromEntries(DIFFICULTIES.map((d) => [d, list.filter((q) => q.difficulty === d).length]))));
console.log("Total QP:", list.reduce((s, q) => s + q.qp, 0));
console.log("Samples:", JSON.stringify(list.filter((q) => ["Cook's Assistant", "Desert Treasure II - The Fallen Empire", "Recipe for Disaster", "Recipe for Disaster - Evil Dave", "Dragon Slayer I", "Song of the Elves", "Vale Totems"].includes(q.name))));
console.log("Quest points (first 5 with points):", JSON.stringify(list.filter((q) => q.qp > 0).slice(0, 5).map((q) => [q.name, q.qp])));

// WikiSync check: which quest names it uses, and which don't match the list.
const wikiSyncNames = new Set();
for (const rsn of sampleRsns) {
  const res = await fetch(`https://sync.runescape.wiki/runelite/player/${encodeURIComponent(rsn)}/STANDARD`, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    console.log(`\nWikiSync ${rsn}: HTTP ${res.status}`);
    continue;
  }
  const data = await res.json();
  const q = data.quests ?? {};
  const statuses = Object.values(q).reduce((acc, v) => ((acc[v] = (acc[v] ?? 0) + 1), acc), {});
  console.log(`\nWikiSync ${rsn}: top-level keys ${Object.keys(data).join(", ")} · timestamp ${data.timestamp} · ${Object.keys(q).length} quests · status counts ${JSON.stringify(statuses)}`);
  for (const k of Object.keys(q)) if (!WIKISYNC_IGNORE.has(k)) wikiSyncNames.add(k);
}
if (wikiSyncNames.size) {
  const notInList = [...wikiSyncNames].filter((n) => !quests.has(n));
  const notInSync = list.filter((q) => !wikiSyncNames.has(q.name)).map((q) => q.name);
  console.log(`\nWikiSync names not in the wiki list (${notInList.length}): ${JSON.stringify(notInList)}`);
  console.log(`Wiki list names WikiSync doesn't report (${notInSync.length}): ${JSON.stringify(notInSync)}`);
}

writeFileSync(
  out,
  JSON.stringify({ source: "https://oldschool.runescape.wiki/w/Quests/List", wikiSyncNames: [...wikiSyncNames].sort(), quests: list }, null, 1) + "\n"
);
console.log(`\nWrote ${out}`);
