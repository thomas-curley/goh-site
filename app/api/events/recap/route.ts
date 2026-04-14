import { NextRequest, NextResponse } from "next/server";
import { postToChannel } from "@/lib/discord";

export async function POST(request: NextRequest) {
  const channelId = process.env.DISCORD_RESULTS_CHANNEL_ID;
  if (!channelId) {
    return NextResponse.json({ error: "DISCORD_RESULTS_CHANNEL_ID not set" }, { status: 503 });
  }

  try {
    const { title, description, highlights, winners, imageUrl, author } = await request.json();

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    // Build the gnome-themed recap message
    const lines: string[] = [];

    lines.push(`🏰 **Event Recap: ${title}** 🏰`);
    lines.push("");

    if (description?.trim()) {
      lines.push(description);
      lines.push("");
    }

    // Highlights
    const validHighlights = (highlights ?? []).filter((h: string) => h?.trim());
    if (validHighlights.length > 0) {
      lines.push("⭐ **Highlights**");
      for (const h of validHighlights) {
        lines.push(`• ${h}`);
      }
      lines.push("");
    }

    // Winners with medals
    const validWinners = (winners ?? []).filter((w: { rsn: string }) => w?.rsn?.trim());
    if (validWinners.length > 0) {
      lines.push("🏆 **Winners**");
      validWinners.forEach((w: { rsn: string; prize: string }, i: number) => {
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "🎖️";
        const prize = w.prize?.trim() ? ` — ${w.prize}` : "";
        lines.push(`${medal} **${w.rsn}**${prize}`);
      });
      lines.push("");
    }

    lines.push(`Thanks for coming! See you at the next one 🌳`);
    if (author) lines.push(`— ${author}`);

    const message = lines.join("\n");

    const result = await postToChannel(channelId, message, imageUrl || undefined);

    return NextResponse.json({ posted: true, message_id: result.id });
  } catch (err) {
    console.error("Event recap post error:", err);
    return NextResponse.json({ error: "Failed to post recap to Discord" }, { status: 500 });
  }
}
