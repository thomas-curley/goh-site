import { NextResponse } from "next/server";

const DISCORD_API = "https://discord.com/api/v10";

export async function GET() {
  const token = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!token || !guildId) {
    return NextResponse.json({ error: "Discord not configured" }, { status: 503 });
  }

  try {
    const res = await fetch(`${DISCORD_API}/guilds/${guildId}/roles`, {
      headers: { Authorization: `Bot ${token}` },
    });

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
    }

    const roles = await res.json();

    // Filter out @everyone and bot roles, sort by position
    const filtered = roles
      .filter((r: { name: string; managed: boolean }) => r.name !== "@everyone" && !r.managed)
      .sort((a: { position: number }, b: { position: number }) => b.position - a.position)
      .map((r: { id: string; name: string; color: number }) => ({
        id: r.id,
        name: r.name,
        color: r.color ? `#${r.color.toString(16).padStart(6, "0")}` : null,
      }));

    return NextResponse.json({ roles: filtered });
  } catch {
    return NextResponse.json({ error: "Failed to fetch roles" }, { status: 500 });
  }
}
