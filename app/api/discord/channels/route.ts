import { NextResponse } from "next/server";

const DISCORD_API = "https://discord.com/api/v10";

// Discord channel types that can receive a bot-posted text message.
const TEXT_CHANNEL_TYPES = new Set([0, 5]);
const CATEGORY_TYPE = 4;

export async function GET() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !guildId) {
    return NextResponse.json({ error: "Discord not configured" }, { status: 503 });
  }

  try {
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/channels`, {
      headers: { Authorization: `Bot ${token}` },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch channels" }, { status: 500 });
    }

    const channels: { id: string; name: string; type: number; position: number; parent_id: string | null }[] = await res.json();

    const categoryNames = new Map(
      channels.filter((c) => c.type === CATEGORY_TYPE).map((c) => [c.id, c.name])
    );

    const filtered = channels
      .filter((c) => TEXT_CHANNEL_TYPES.has(c.type))
      .sort((a, b) => a.position - b.position)
      .map((c) => ({
        id: c.id,
        name: c.name,
        category: c.parent_id ? categoryNames.get(c.parent_id) ?? null : null,
      }));

    return NextResponse.json({ channels: filtered });
  } catch {
    return NextResponse.json({ error: "Failed to fetch channels" }, { status: 500 });
  }
}
