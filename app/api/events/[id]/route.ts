import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { updateDiscordEvent, deleteDiscordEvent, editChannelMessage } from "@/lib/discord";
import { renderTemplate } from "@/lib/post-templates";
import { resolveTemplate } from "@/lib/post-templates-server";
import { getAlertChannel } from "@/lib/alert-channels";
import { CLAN_TIMEZONE } from "@/lib/constants";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  try {
    const body = await request.json();

    // None of these are `events` columns — they either drive the Discord-sync
    // steps below or are leftover create-only form flags (EventForm is
    // shared between the create and edit pages) — never let them reach the
    // .update() spread or Postgrest errors on an unknown column. ping_roles
    // and extra_images ARE real columns (unlike the others here) but still
    // need pulling out to validate/default them before they're re-spread in.
    const {
      sync_discord_post,
      sync_signup_thread,
      templateId,
      signupThreadTemplateId,
      ping_roles,
      extra_images,
      post_to_discord,
      create_signup_thread,
      ...eventFields
    } = body;

    // Update in Supabase
    const { data, error } = await supabase
      .from("events")
      .update({
        ...eventFields,
        ping_roles: Array.isArray(ping_roles) ? ping_roles : [],
        extra_images: Array.isArray(extra_images) ? extra_images : [],
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sync to Discord if event has a linked Discord event
    if (data.discord_event_id) {
      try {
        await updateDiscordEvent(data.discord_event_id, {
          name: data.title,
          description: data.description ?? undefined,
          scheduled_start_time: data.start_time,
          scheduled_end_time: data.end_time ?? undefined,
          entity_type: 3,
          entity_metadata: {
            location: [data.location, data.meet_location].filter(Boolean).join(" — Meet: ") || "In-game",
          },
          privacy_level: 2,
        });
      } catch (discordErr) {
        console.error("Discord event update failed:", discordErr);
      }
    }

    const sync: { eventPostSynced?: boolean; signupThreadSynced?: boolean; errors: string[] } = { errors: [] };
    const startDate = new Date(data.start_time);
    const dateStr = startDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: CLAN_TIMEZONE });
    const timeStr = startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short", timeZone: CLAN_TIMEZONE });

    if (sync_discord_post && data.discord_message_id) {
      // Sync to wherever this event was actually posted, not always the
      // default channel — events can be posted to a custom destination now.
      const channelId = data.discord_channel_id ?? (await getAlertChannel(supabase, "events"));
      try {
        if (!channelId) throw new Error("No events alert channel configured (Admin > Alert Channels, or DISCORD_EVENTS_CHANNEL_ID)");
        const template = await resolveTemplate(supabase, "event_post", templateId);
        if (!template) throw new Error("No event_post template configured");
        const message = renderTemplate(template.sections, {
          title: data.title,
          description: data.description,
          host_rsn: data.host_rsn,
          dateStr,
          timeStr,
          world: data.world,
          meet_location: data.meet_location,
          spots: data.spots,
          signup_type: data.signup_type,
          voice_channel: data.voice_channel,
          prize_pool: data.prize_pool,
          requirements: data.requirements,
          requirements_list: data.requirements_list,
          guide_text: data.guide_text,
          video_url: data.video_url,
          pingRoles: ping_roles,
        });
        const allImages: string[] = [];
        if (data.banner_url) allImages.push(data.banner_url);
        if (Array.isArray(extra_images)) allImages.push(...extra_images.filter(Boolean));
        await editChannelMessage(channelId, data.discord_message_id, message, allImages.length > 0 ? allImages : undefined);
        sync.eventPostSynced = true;
      } catch (err) {
        console.error("Event post sync failed:", err);
        sync.errors.push("Failed to update the Discord event post — the original message may have been deleted.");
      }
    }

    if (sync_signup_thread && data.signup_thread_id && data.signup_thread_message_id) {
      try {
        const template = await resolveTemplate(supabase, "signup_thread", signupThreadTemplateId);
        if (!template) throw new Error("No signup_thread template configured");
        const message = renderTemplate(template.sections, {
          title: data.title,
          dateStr,
          host_rsn: data.host_rsn,
          spots: data.spots,
        });
        await editChannelMessage(data.signup_thread_id, data.signup_thread_message_id, message);
        sync.signupThreadSynced = true;
      } catch (err) {
        console.error("Signup thread sync failed:", err);
        sync.errors.push("Failed to update the signup thread message — it may have been deleted.");
      }
    }

    return NextResponse.json({ event: data, sync });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  }

  // Get event first to check for Discord event ID
  const { data: event } = await supabase
    .from("events")
    .select("discord_event_id")
    .eq("id", id)
    .single();

  // Delete from Supabase
  const { error } = await supabase
    .from("events")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Delete from Discord if linked
  if (event?.discord_event_id) {
    try {
      await deleteDiscordEvent(event.discord_event_id);
    } catch (discordErr) {
      console.error("Discord event delete failed:", discordErr);
    }
  }

  return NextResponse.json({ deleted: true });
}
