import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { postToChannel } from "@/lib/discord";
import { renderTemplate } from "@/lib/post-templates";
import { resolveTemplate } from "@/lib/post-templates-server";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  const channelId = process.env.DISCORD_ANNOUNCEMENTS_CHANNEL_ID;
  if (!channelId) {
    return NextResponse.json({ error: "DISCORD_ANNOUNCEMENTS_CHANNEL_ID not set" }, { status: 503 });
  }

  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const { title, content, author, bannerUrl, images, pingRoles, templateId } = await request.json();

    if (!title || !content) {
      return NextResponse.json({ error: "title and content required" }, { status: 400 });
    }

    const template = await resolveTemplate(supabase, "announcement", templateId);
    if (!template) {
      return NextResponse.json({ error: "No announcement template configured" }, { status: 500 });
    }

    const message = renderTemplate(template.sections, { title, content, author, pingRoles });

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
