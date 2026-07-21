import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { postToChannel, editChannelMessage } from "@/lib/discord";
import { renderTemplate } from "@/lib/post-templates";
import { resolveTemplate } from "@/lib/post-templates-server";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// POST - post (or, if already posted, edit in place) the Discord message for
// this announcement. Self-contained: fetches the row itself rather than
// trusting client-supplied duplicate data, and persists the resulting
// message id back onto the row so it can be found and edited again later.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const channelId = process.env.DISCORD_ANNOUNCEMENTS_CHANNEL_ID;
  if (!channelId) {
    return NextResponse.json({ error: "DISCORD_ANNOUNCEMENTS_CHANNEL_ID not set" }, { status: 503 });
  }

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const { data: row } = await supabase
      .from("announcements")
      .select("title, content, author_name, banner_url, discord_message_id")
      .eq("id", id)
      .single();

    if (!row) {
      return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
    }

    const { images, pingRoles, templateId } = await request.json().catch(() => ({}));

    const template = await resolveTemplate(supabase, "announcement", templateId);
    if (!template) {
      return NextResponse.json({ error: "No announcement template configured" }, { status: 500 });
    }

    const message = renderTemplate(template.sections, {
      title: row.title,
      content: row.content,
      author: row.author_name,
      pingRoles,
    });

    // Additional images aren't persisted on the row — only what's supplied
    // fresh in this request (plus the saved banner) can be included.
    const allImages: string[] = [];
    if (row.banner_url) allImages.push(row.banner_url);
    if (Array.isArray(images)) allImages.push(...images.filter(Boolean));
    const imagePayload = allImages.length > 0 ? allImages : undefined;

    if (row.discord_message_id) {
      try {
        await editChannelMessage(channelId, row.discord_message_id, message, imagePayload);
      } catch (err) {
        console.error("Discord announcement edit error:", err);
        return NextResponse.json(
          { error: "The original Discord message no longer exists — it may have been deleted." },
          { status: 409 }
        );
      }
      return NextResponse.json({ posted: true, edited: true, message_id: row.discord_message_id });
    }

    const result = await postToChannel(channelId, message, imagePayload);
    await supabase.from("announcements").update({ discord_message_id: result.id }).eq("id", id);

    return NextResponse.json({ posted: true, edited: false, message_id: result.id });
  } catch (err) {
    console.error("Discord announcement sync error:", err);
    return NextResponse.json({ error: "Failed to sync to Discord" }, { status: 500 });
  }
}
