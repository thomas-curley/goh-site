import { NextRequest, NextResponse } from "next/server";
import { postToChannel } from "@/lib/discord";

const CATEGORY_EMOJIS: Record<string, string> = {
  announcement: "📢",
  update: "🔄",
  event_recap: "📸",
  patch_notes: "📋",
  community: "🏠",
};

export async function POST(request: NextRequest) {
  const channelId = process.env.DISCORD_ANNOUNCEMENTS_CHANNEL_ID;
  if (!channelId) {
    return NextResponse.json({ error: "DISCORD_ANNOUNCEMENTS_CHANNEL_ID not set" }, { status: 503 });
  }

  try {
    const { title, content, category, author, bannerUrl } = await request.json();

    if (!title || !content) {
      return NextResponse.json({ error: "title and content required" }, { status: 400 });
    }

    const emoji = CATEGORY_EMOJIS[category] ?? "📢";
    const message = [
      `${emoji} **${title}**`,
      "",
      content,
      "",
      author ? `— ${author}` : null,
    ].filter((l) => l !== null).join("\n");

    const result = await postToChannel(channelId, message, bannerUrl || undefined);

    return NextResponse.json({ posted: true, message_id: result.id });
  } catch (err) {
    console.error("Discord announcement post error:", err);
    return NextResponse.json({ error: "Failed to post to Discord" }, { status: 500 });
  }
}
