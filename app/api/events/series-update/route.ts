import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { postToDestination, editChannelMessage, resolvePostDestination } from "@/lib/discord";
import { renderTemplate } from "@/lib/post-templates";
import { resolveTemplate } from "@/lib/post-templates-server";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/**
 * Posts a quick "here's what we're doing tonight" update for a recurring
 * series night (PVM Thursday, Skilling Friday, etc.) without creating a new
 * `events` row -- the series' own occurrences already come in automatically
 * via the Discord recurring-scheduled-event sync. See
 * 059_series_update_posts.sql for the tracking table this reads/writes.
 */
export async function POST(request: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const {
      seriesTitle, discordEventId, description, author, signAsAuthor, pingRoles,
      destination, templateId, postId,
    } = await request.json();

    if (!seriesTitle || !description) {
      return NextResponse.json({ error: "seriesTitle and description are required" }, { status: 400 });
    }

    let existing: { destination_channel_id: string; discord_message_id: string | null } | null = null;
    if (postId) {
      const { data } = await supabase
        .from("series_update_posts")
        .select("destination_channel_id, discord_message_id")
        .eq("id", postId)
        .single();
      existing = data ?? null;
    }

    const requestedChannelId = typeof destination === "string" && destination.trim() ? resolvePostDestination(destination, null) : null;
    const channelId = requestedChannelId ?? existing?.destination_channel_id ?? null;
    if (!channelId) {
      return NextResponse.json({ error: "Choose a Discord channel to post this update to." }, { status: 400 });
    }

    // A destination change means "post fresh here", not "edit the old
    // message" -- editing requires the message and channel to still match.
    const destinationChanged = existing ? channelId !== existing.destination_channel_id : false;

    const template = await resolveTemplate(supabase, "series_update", templateId);
    if (!template) {
      return NextResponse.json({ error: "No series update template configured" }, { status: 500 });
    }

    const message = renderTemplate(template.sections, {
      series_title: seriesTitle,
      description,
      author: signAsAuthor ? author : undefined,
      pingRoles,
    });

    let messageId: string;
    let actualChannelId = channelId;
    let edited = false;

    if (existing?.discord_message_id && !destinationChanged) {
      try {
        await editChannelMessage(channelId, existing.discord_message_id, message);
      } catch (err) {
        console.error("Series update edit error:", err);
        return NextResponse.json(
          { error: "The original Discord message no longer exists — it may have been deleted." },
          { status: 409 }
        );
      }
      messageId = existing.discord_message_id;
      edited = true;
    } else {
      const posted = await postToDestination(channelId, seriesTitle, message);
      messageId = posted.messageId;
      actualChannelId = posted.channelId;
    }

    const row = {
      discord_event_id: discordEventId || null,
      series_title: seriesTitle,
      description,
      ping_roles: Array.isArray(pingRoles) ? pingRoles : [],
      template_id: templateId || null,
      destination_channel_id: actualChannelId,
      discord_message_id: messageId,
      author_name: author || null,
      updated_at: new Date().toISOString(),
    };

    let savedId = postId;
    if (postId) {
      await supabase.from("series_update_posts").update(row).eq("id", postId);
    } else {
      const { data: inserted } = await supabase.from("series_update_posts").insert(row).select("id").single();
      savedId = inserted?.id ?? null;
    }

    return NextResponse.json({ posted: true, edited, message_id: messageId, post_id: savedId });
  } catch (err) {
    console.error("Series update post error:", err);
    return NextResponse.json({ error: "Failed to post series update to Discord" }, { status: 500 });
  }
}
