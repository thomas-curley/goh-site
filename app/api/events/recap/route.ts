import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { postToChannel, parseDiscordMessageLink, isDiscordSnowflake } from "@/lib/discord";
import { renderTemplate } from "@/lib/post-templates";
import { resolveTemplate } from "@/lib/post-templates-server";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function resolveChannelId(input?: string): string | null {
  if (typeof input === "string" && input.trim()) {
    const { channelId } = parseDiscordMessageLink(input);
    if (channelId) return channelId;
    if (isDiscordSnowflake(input)) return input.trim();
    return null;
  }
  return process.env.DISCORD_RESULTS_CHANNEL_ID ?? null;
}

export async function POST(request: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const { title, description, highlights, winners, images, author, pingRoles, destination, templateId } = await request.json();

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    const channelId = resolveChannelId(destination);
    if (!channelId) {
      return NextResponse.json(
        { error: "Enter a forum post link or ID to post the recap to (or a Discord message link from that post)." },
        { status: 400 }
      );
    }

    const template = await resolveTemplate(supabase, "event_recap", templateId);
    if (!template) {
      return NextResponse.json({ error: "No event recap template configured" }, { status: 500 });
    }

    const message = renderTemplate(template.sections, { title, description, highlights, winners, author, pingRoles });

    // Support multiple images
    const imageUrls = Array.isArray(images) ? images.filter(Boolean) : [];
    const result = await postToChannel(channelId, message, imageUrls.length > 0 ? imageUrls : undefined);

    return NextResponse.json({ posted: true, message_id: result.id });
  } catch (err) {
    console.error("Event recap post error:", err);
    return NextResponse.json({ error: "Failed to post recap to Discord" }, { status: 500 });
  }
}
