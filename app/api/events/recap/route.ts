import { NextRequest, NextResponse } from "next/server";
import { postToChannel } from "@/lib/discord";

export async function POST(request: NextRequest) {
  const channelId = process.env.DISCORD_RESULTS_CHANNEL_ID;
  if (!channelId) {
    return NextResponse.json({ error: "DISCORD_RESULTS_CHANNEL_ID not set" }, { status: 503 });
  }

  try {
    const { title, description, highlights, winners, images, emojis, author, pingRoles } = await request.json();

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const e = (key: string, def: string) => emojis?.[key] ?? def;

    const lines: string[] = [];

    // Role pings
    if (Array.isArray(pingRoles) && pingRoles.length > 0) {
      const pings = pingRoles.map((id: string) => {
        if (id === "@everyone") return "@everyone";
        if (id === "@here") return "@here";
        return `<@&${id}>`;
      }).join(" ");
      lines.push(pings);
      lines.push("");
    }

    lines.push(`${e("header", "🏰")} **Event Recap: ${title}** ${e("header", "🏰")}`);
    lines.push("");

    if (description?.trim()) {
      lines.push(description);
      lines.push("");
    }

    const validHighlights = (highlights ?? []).filter((h: string) => h?.trim());
    if (validHighlights.length > 0) {
      lines.push(`${e("highlights", "⭐")} **Highlights**`);
      for (const h of validHighlights) {
        lines.push(`• ${h}`);
      }
      lines.push("");
    }

    const validWinners = (winners ?? []).filter((w: { rsn: string }) => w?.rsn?.trim());
    if (validWinners.length > 0) {
      lines.push(`${e("winners", "🏆")} **Winners**`);
      validWinners.forEach((w: { rsn: string; prize: string }, i: number) => {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🎖️";
        const prize = w.prize?.trim() ? ` — ${w.prize}` : "";
        lines.push(`${medal} **${w.rsn}**${prize}`);
      });
      lines.push("");
    }

    lines.push(`Thanks for coming! See you at the next one ${e("signoff", "🌳")}`);
    if (author) lines.push(`— ${author}`);

    const message = lines.join("\n");

    // Support multiple images
    const imageUrls = Array.isArray(images) ? images.filter(Boolean) : [];
    const result = await postToChannel(channelId, message, imageUrls.length > 0 ? imageUrls : undefined);

    return NextResponse.json({ posted: true, message_id: result.id });
  } catch (err) {
    console.error("Event recap post error:", err);
    return NextResponse.json({ error: "Failed to post recap to Discord" }, { status: 500 });
  }
}
