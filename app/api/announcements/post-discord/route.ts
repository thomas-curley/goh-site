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
    const { title, content, category, author, bannerUrl, images, customEmoji, pingRoles } = await request.json();

    if (!title || !content) {
      return NextResponse.json({ error: "title and content required" }, { status: 400 });
    }

    let pingPrefix = "";
    if (Array.isArray(pingRoles) && pingRoles.length > 0) {
      pingPrefix = pingRoles.map((id: string) => {
        if (id === "@everyone") return "@everyone";
        if (id === "@here") return "@here";
        return `<@&${id}>`;
      }).join(" ") + "\n\n";
    }

    const emoji = customEmoji ?? CATEGORY_EMOJIS[category] ?? "📢";
    const message = [
      pingPrefix ? pingPrefix.trim() : null,
      `${emoji} **${title}**`,
      "",
      content,
      "",
      author ? `— ${author}` : null,
    ].filter((l) => l !== null).join("\n");

    // Combine banner + additional images
    const allImages: string[] = [];
    if (bannerUrl) allImages.push(bannerUrl);
    if (Array.isArray(images)) allImages.push(...images.filter(Boolean));

    const result = await postToChannel(channelId, message, allImages.length > 0 ? allImages : undefined);

    return NextResponse.json({ posted: true, message_id: result.id });
  } catch (err) {
    console.error("Discord announcement post error:", err);
    return NextResponse.json({ error: "Failed to post to Discord" }, { status: 500 });
  }
}
