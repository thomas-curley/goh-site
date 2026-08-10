import { NextResponse } from "next/server";

const DISCORD_API = "https://discord.com/api/v10";

// Discord channel types that can receive a bot-posted text message.
const TEXT_CHANNEL_TYPES = new Set([0, 5]);
const CATEGORY_TYPE = 4;

interface ChannelListResult {
  channels: { id: string; name: string; category: string | null }[];
  threads: { id: string; name: string; parentChannel: string | null }[];
}

// ChannelSelector renders once per "Post To" field, and /admin/alert-channels
// renders one per feature row (9+ at once on a single page load) -- cache
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
      // You can't post directly into a forum channel, only into one of its
      // threads, so this is what actually resolves "post to Minigame Monday".
      fetch(`${DISCORD_API}/guilds/${guildId}/threads/active`, { headers: { Authorization: `Bot ${token}` } }),
    ]);

    if (!channelsRes.ok) {
      return NextResponse.json({ error: "Failed to fetch channels" }, { status: 500 });
    }

    const channels: { id: string; name: string; type: number; position: number; parent_id: string | null }[] = await channelsRes.json();
    const threadsBody: { threads?: { id: string; name: string; parent_id: string | null }[] } = threadsRes.ok ? await threadsRes.json() : {};

    const categoryNames = new Map(
      channels.filter((c) => c.type === CATEGORY_TYPE).map((c) => [c.id, c.name])
    );
    const channelNames = new Map(channels.map((c) => [c.id, c.name]));

    const filtered = channels
      .filter((c) => TEXT_CHANNEL_TYPES.has(c.type))
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        id: c.id,
        name: c.name,
        category: c.parent_id ? categoryNames.get(c.parent_id) ?? null : null,
      }));

    const threads = (threadsBody.threads ?? [])
      .map((t) => ({
        id: t.id,
        name: t.name,
        parentChannel: t.parent_id ? channelNames.get(t.parent_id) ?? null : null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const data: ChannelListResult = { channels: filtered, threads };
    cache = { data, fetchedAt: Date.now() };
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Failed to fetch channels" }, { status: 500 });
  }
}
