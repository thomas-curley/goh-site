/**
 * Live OSRS Grand Exchange prices via the OSRS Wiki real-time prices API.
 * Public, no API key, but the API's usage policy asks for a descriptive
 * User-Agent identifying the app.
 */

const MAPPING_URL = "https://prices.runescape.wiki/api/v1/osrs/mapping";
const LATEST_URL = "https://prices.runescape.wiki/api/v1/osrs/latest";
const USER_AGENT = "Gn0meHome-Website - loot split tool";

const MAPPING_TTL_MS = 60 * 60 * 1000; // 1 hour, item list rarely changes
const PRICES_TTL_MS = 60 * 1000; // 60 seconds, near-live

export interface ItemMapping {
  id: number;
  name: string;
}

export interface ItemPrice {
  high: number | null;
  low: number | null;
}

export interface ItemSearchResult {
  id: number;
  name: string;
  price: number | null;
}

let mappingCache: { data: ItemMapping[]; fetchedAt: number } | null = null;
let pricesCache: { data: Record<string, ItemPrice>; fetchedAt: number } | null = null;

export async function getItemMapping(): Promise<ItemMapping[]> {
  if (mappingCache && Date.now() - mappingCache.fetchedAt < MAPPING_TTL_MS) {
    return mappingCache.data;
  }

  const res = await fetch(MAPPING_URL, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return mappingCache?.data ?? [];

  const raw: { id: number; name?: string }[] = await res.json();
  const data = raw.filter((item): item is { id: number; name: string } => Boolean(item.name)).map((item) => ({
    id: item.id,
    name: item.name,
  }));

  mappingCache = { data, fetchedAt: Date.now() };
  return data;
}

export async function getLatestPrices(): Promise<Record<string, ItemPrice>> {
  if (pricesCache && Date.now() - pricesCache.fetchedAt < PRICES_TTL_MS) {
    return pricesCache.data;
  }

  const res = await fetch(LATEST_URL, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) return pricesCache?.data ?? {};

  const body: { data: Record<string, { high: number | null; low: number | null }> } = await res.json();
  pricesCache = { data: body.data, fetchedAt: Date.now() };
  return body.data;
}

function priceFor(entry: ItemPrice | undefined): number | null {
  if (!entry) return null;
  if (entry.high != null && entry.low != null) return Math.round((entry.high + entry.low) / 2);
  return entry.high ?? entry.low ?? null;
}

export async function searchItems(query: string, limit: number = 15): Promise<ItemSearchResult[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];

  const [mapping, prices] = await Promise.all([getItemMapping(), getLatestPrices()]);

  return mapping
    .filter((item) => item.name.toLowerCase().includes(q))
    .slice(0, limit)
    .map((item) => ({
      id: item.id,
      name: item.name,
      price: priceFor(prices[String(item.id)]),
    }));
}
