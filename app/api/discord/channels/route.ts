import { NextResponse } from "next/server";

const DISCORD_API = "https://discord.com/api/v10";

const CATEGORY_TYPE = 4;
// Channel types the site can post into: text and announcement channels take
// a message; forum and media channels take a new post (see
// postToDestination in lib/discord.ts).
const POSTABLE_TYPES: Record<number, ChannelKind> = { 0: "text", 5: "announcement", 15: "forum", 16: "forum" };

type ChannelKind = "text" | "announcement" | "forum";

export interface ChannelListThread {
  id: string;
  name: string;
}

export interface ChannelListChannel {
  id: string;
  name: string;
  kind: ChannelKind;
  /** Active threads/forum posts under this channel, newest first. */
  threads: ChannelListThread[];
}

export interface ChannelListResult {
  /** One per Discord category, in Discord's sidebar order (uncategorized first). */
  groups: { category: string | null; channels: ChannelListChannel[] }[];
  /** Active threads whose parent isn't listed above (e.g. a voice channel's text chat). */
  otherThreads: ChannelListThread[];
}

interface RawChannel {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id: string | null;
}

/** Snowflakes encode creation time, so a bigger id is a newer thread. */
function newestFirst(a: { id: string }, b: { id: string }): number {
  const x = BigInt(a.id);
  const y = BigInt(b.id);
  return x === y ? 0 : x > y ? -1 : 1;
}

// ChannelSelector renders once per "Post To" field, and /admin/alert-channels
// renders one per feature row (15+ at once on a single page load) -- cache
// briefly so that doesn't turn into a burst of duplicate Discord API calls.
let cache: { data: ChannelListResult; fetchedAt: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function GET() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !guildId) {
    return NextResponse.json({ error: "Discord not configured" }, { status: 503 });
  }

  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(cache.data);
  }

  try {
    const [channelsRes, threadsRes] = await Promise.all([
      fetch(`${DISCORD_API}/guilds/${guildId}/channels`, { headers: { Authorization: `Bot ${token}` } }),
      // Active threads -- forum posts and weekly-series threads live here.
      fetch(`${DISCORD_API}/guilds/${guildId}/threads/active`, { headers: { Authorization: `Bot ${token}` } }),
    ]);

    if (!channelsRes.ok) {
      return NextResponse.json({ error: "Failed to fetch channels" }, { status: 500 });
    }

    const channels: RawChannel[] = await channelsRes.json();
    const threadsBody: { threads?: { id: string; name: string; parent_id: string | null }[] } = threadsRes.ok ? await threadsRes.json() : {};

    // Threads grouped under their parent channel.
    const threadsByParent = new Map<string, ChannelListThread[]>();
    const otherThreads: ChannelListThread[] = [];
    const postableIds = new Set(channels.filter((c) => c.type in POSTABLE_TYPES).map((c) => c.id));
    for (const t of threadsBody.threads ?? []) {
      const thread = { id: t.id, name: t.name };
      if (t.parent_id && postableIds.has(t.parent_id)) {
        const list = threadsByParent.get(t.parent_id) ?? [];
        list.push(thread);
        threadsByParent.set(t.parent_id, list);
      } else {
        otherThreads.push(thread);
      }
    }

    // Discord's sidebar order: uncategorized channels first, then each
    // category by its position; channels by position within a category.
    // (Positions are only meaningful among siblings, so sorting every channel
    // by position in one flat list interleaves categories.)
    const byPosition = (a: RawChannel, b: RawChannel) => a.position - b.position || newestFirst(b, a);
    const categories = channels.filter((c) => c.type === CATEGORY_TYPE).sort(byPosition);
    const toEntry = (c: RawChannel): ChannelListChannel => ({
      id: c.id,
      name: c.name,
      kind: POSTABLE_TYPES[c.type],
      threads: (threadsByParent.get(c.id) ?? []).sort(newestFirst),
    });
    const postableIn = (parentId: string | null) =>
      channels.filter((c) => c.type in POSTABLE_TYPES && (c.parent_id ?? null) === parentId).sort(byPosition).map(toEntry);

    const groups = [
      { category: null, channels: postableIn(null) },
      ...categories.map((cat) => ({ category: cat.name, channels: postableIn(cat.id) })),
    ].filter((g) => g.channels.length > 0);

    const data: ChannelListResult = { groups, otherThreads: otherThreads.sort(newestFirst) };
    cache = { data, fetchedAt: Date.now() };
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch channels" }, { status: 500 });
  }
}
