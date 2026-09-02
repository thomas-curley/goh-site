import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { postToDestination, editChannelMessage, resolvePostDestination, closeForumThread } from "@/lib/discord";
import { parseThreadAutoArchive } from "@/lib/thread-archive";
import { renderTemplate } from "@/lib/post-templates";
import { resolveTemplate } from "@/lib/post-templates-server";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function POST(request: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const {
      title, description, highlights, winners, lootItems, images, author, signAsAuthor, pingRoles,
      destination, templateId, dateStr, eventId, recapId, closeForumPost, autoArchiveDuration,
    } = await request.json();

    if (!title) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }

    // If editing, load the existing tracking row to know where it lives today.
    let existing: { destination_channel_id: string; discord_message_id: string | null } | null = null;
    if (recapId) {
      const { data } = await supabase
        .from("event_recap_posts")
        .select("destination_channel_id, discord_message_id")
        .eq("id", recapId)
        .single();
      existing = data ?? null;
    }

    const requestedChannelId = typeof destination === "string" && destination.trim() ? resolvePostDestination(destination, null) : null;
    const channelId = requestedChannelId ?? existing?.destination_channel_id ?? null;
    if (!channelId) {
      return NextResponse.json(
        { error: "Enter a forum post link or ID to post the recap to (or a Discord message link from that post)." },
        { status: 400 }
      );
    }

    // A destination change means "post fresh here", not "edit the old
    // message" — editing requires the message and channel to still match.
    const destinationChanged = existing ? channelId !== existing.destination_channel_id : false;

    const template = await resolveTemplate(supabase, "event_recap", templateId);
    if (!template) {
      return NextResponse.json({ error: "No event recap template configured" }, { status: 500 });
    }

    // Author Signoff is a requireKeys:["author"] line -- leaving author
    // unset skips it entirely, matching how hosts usually already sign off
    // themselves within the recap body. author_name is still always
    // persisted on the row below regardless, for record-keeping.
    const message = renderTemplate(template.sections, { title, description, highlights, winners, lootItems, author: signAsAuthor ? author : undefined, pingRoles, dateStr });
    const imageUrls = Array.isArray(images) ? images.filter(Boolean) : [];
    const imagePayload = imageUrls.length > 0 ? imageUrls : undefined;

    let messageId: string;
    let actualChannelId = channelId;
    let edited = false;

    if (existing?.discord_message_id && !destinationChanged) {
      try {
        await editChannelMessage(channelId, existing.discord_message_id, message, imagePayload);
      } catch (err) {
        console.error("Event recap edit error:", err);
        return NextResponse.json(
          { error: "The original Discord message no longer exists — it may have been deleted." },
          { status: 409 }
        );
      }
      messageId = existing.discord_message_id;
      edited = true;
    } else {
      const posted = await postToDestination(channelId, title, message, imagePayload, parseThreadAutoArchive(autoArchiveDuration));
      messageId = posted.messageId;
      actualChannelId = posted.channelId;
    }

    const row = {
      event_id: eventId || null,
      title,
      description: description || null,
      highlights: Array.isArray(highlights) ? highlights : [],
      winners: Array.isArray(winners) ? winners : [],
      loot_items: Array.isArray(lootItems) ? lootItems : [],
      images: imageUrls,
      ping_roles: Array.isArray(pingRoles) ? pingRoles : [],
      template_id: templateId || null,
      destination_channel_id: actualChannelId,
      discord_message_id: messageId,
      author_name: author || null,
      updated_at: new Date().toISOString(),
    };

    let savedId = recapId;
    if (recapId) {
      await supabase.from("event_recap_posts").update(row).eq("id", recapId);
    } else {
      const { data: inserted } = await supabase.from("event_recap_posts").insert(row).select("id").single();
      savedId = inserted?.id ?? null;
    }

    let forumClosed: boolean | undefined;
    if (closeForumPost === true) {
      forumClosed = await closeForumThread(actualChannelId);
    }

    return NextResponse.json({ posted: true, edited, message_id: messageId, recap_id: savedId, forum_closed: forumClosed });
  } catch (err) {
    console.error("Event recap post error:", err);
    return NextResponse.json({ error: "Failed to post recap to Discord" }, { status: 500 });
  }
}
