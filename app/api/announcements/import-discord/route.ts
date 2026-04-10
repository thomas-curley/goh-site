import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getChannelMessages } from "@/lib/discord";

const ANNOUNCEMENTS_CHANNEL_ID = "1486887506367611063";

export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    // Fetch recent messages from Discord announcements channel
    const messages = await getChannelMessages(ANNOUNCEMENTS_CHANNEL_ID, 50);

    if (!Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ imported: 0, message: "No messages found in channel." });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Get existing discord message IDs to avoid duplicates
    const { data: existing } = await supabase
      .from("announcements")
      .select("discord_message_id")
      .not("discord_message_id", "is", null);

    const existingIds = new Set((existing ?? []).map((a) => a.discord_message_id));

    // Filter to non-bot messages with actual content, skip already imported
    const toImport = messages.filter(
      (msg: { id: string; content: string; author: { bot?: boolean } }) =>
        msg.content?.trim() &&
        !msg.author?.bot &&
        !existingIds.has(msg.id)
    );

    if (toImport.length === 0) {
      return NextResponse.json({ imported: 0, message: "All announcements already imported." });
    }

    // Import each message as an announcement
    const rows = toImport.map(
      (msg: {
        id: string;
        content: string;
        author: { username: string; global_name?: string };
        timestamp: string;
      }) => {
        // Use first line as title, rest as content
        const lines = msg.content.trim().split("\n");
        const firstLine = lines[0]
          .replace(/\*\*/g, "")
          .replace(/<@[!&]?\d+>/g, "")
          .replace(/<#\d+>/g, "")
          .replace(/<:\w+:\d+>/g, "")
          .trim()
          .slice(0, 200);

        const title = firstLine || "Discord Announcement";
        const content = lines.length > 1
          ? lines.slice(1).join("\n").trim()
          : msg.content.trim();

        return {
          title,
          content,
          category: "announcement",
          published: true,
          author_name: msg.author.global_name ?? msg.author.username,
          discord_message_id: msg.id,
          created_at: msg.timestamp,
          updated_at: new Date().toISOString(),
        };
      }
    );

    const { error } = await supabase.from("announcements").insert(rows);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      imported: rows.length,
      message: `Imported ${rows.length} announcement(s) from Discord.`,
    });
  } catch (err) {
    console.error("Discord import error:", err);
    return NextResponse.json(
      { error: "Failed to import from Discord. Check bot token and channel permissions." },
      { status: 500 }
    );
  }
}
