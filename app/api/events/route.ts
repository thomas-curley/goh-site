import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createDiscordEvent, postToChannel, createSignupThread, resolvePostDestination } from "@/lib/discord";
import { formatDiscordEventDescription } from "@/lib/discord-format";
import { renderTemplate } from "@/lib/post-templates";
import { resolveTemplate } from "@/lib/post-templates-server";
import { getAlertChannel } from "@/lib/alert-channels";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function GET(request: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) {
    return NextResponse.json({ events: [], message: "Supabase not configured" });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("start");
  const endDate = searchParams.get("end");

  let query = supabase.from("events").select("*").order("start_time", { ascending: true });
  if (startDate) query = query.gte("start_time", startDate);
  if (endDate) query = query.lte("start_time", endDate);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ events: data });
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.title || !body.start_time) {
      return NextResponse.json(
        { error: "title and start_time are required" },
        { status: 400 }
      );
    }

    const supabase = getServiceClient();

    // Build event row
    const eventRow = {
      title: body.title,
      description: body.description || null,
      event_type: body.event_type || "other",
      start_time: new Date(body.start_time).toISOString(),
      end_time: body.end_time ? new Date(body.end_time).toISOString() : null,
      host_rsn: body.host_rsn || null,
      world: body.world || null,
      location: body.location || null,
      meet_location: body.meet_location || null,
      spots: body.spots || "Open",
      signup_type: body.signup_type || null,
      voice_channel: body.voice_channel || null,
      requirements: body.requirements || null,
      requirements_list: body.requirements_list || null,
      guide_text: body.guide_text || null,
      video_url: body.video_url || null,
      prize_pool: body.prize_pool || null,
    };

    // Post to Discord if requested
    let discordEventId: string | null = null;
    let discordMessageId: string | null = null;
    let discordChannelId: string | null = null;

    if (body.post_to_discord) {
      try {
        // Create Discord Scheduled Event
        const endTime = eventRow.end_time ?? new Date(new Date(eventRow.start_time).getTime() + 2 * 60 * 60 * 1000).toISOString();

        const discordEvent = await createDiscordEvent({
          name: eventRow.title,
          description: formatDiscordEventDescription(eventRow),
          scheduled_start_time: eventRow.start_time,
          scheduled_end_time: endTime,
          entity_type: 3,
          entity_metadata: {
            location: [eventRow.location, eventRow.meet_location].filter(Boolean).join(" — Meet: ") || "In-game",
          },
          privacy_level: 2,
        });

        discordEventId = discordEvent.id;

        // Post formatted message — to an admin-chosen destination if given,
        // otherwise the configured (or env-default) events channel.
        const eventsChannelDefault = supabase ? await getAlertChannel(supabase, "events") : (process.env.DISCORD_EVENTS_CHANNEL_ID ?? null);
        const channelId = resolvePostDestination(body.destination, eventsChannelDefault);
        if (channelId && supabase) {
          const template = await resolveTemplate(supabase, "event_post", body.templateId);
          if (template) {
            const startDate = new Date(eventRow.start_time);
            const dateStr = startDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
            const timeStr = startDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });

            const message = renderTemplate(template.sections, {
              title: eventRow.title,
              description: eventRow.description,
              host_rsn: eventRow.host_rsn,
              dateStr,
              timeStr,
              world: eventRow.world,
              meet_location: eventRow.meet_location,
              spots: eventRow.spots,
              signup_type: eventRow.signup_type,
              voice_channel: eventRow.voice_channel,
              prize_pool: eventRow.prize_pool,
              requirements: eventRow.requirements,
              requirements_list: eventRow.requirements_list,
              guide_text: eventRow.guide_text,
              video_url: eventRow.video_url,
              pingRoles: body.ping_roles,
            });

            // Combine banner + extra images
            const allImages: string[] = [];
            if (body.banner_url) allImages.push(body.banner_url);
            if (Array.isArray(body.extra_images)) allImages.push(...body.extra_images.filter(Boolean));
            const discordMsg = await postToChannel(channelId, message, allImages.length > 0 ? allImages : undefined);
            discordMessageId = discordMsg.id;
            discordChannelId = channelId;
          }
        }
      } catch (discordError) {
        console.error("Discord post failed:", discordError);
        // Continue — still save to Supabase even if Discord fails
      }
    }

    // Create sign-up thread if requested
    let signupThreadId: string | null = null;
    let signupThreadMessageId: string | null = null;
    if (body.create_signup_thread) {
      try {
        const signupsChannelId = supabase ? await getAlertChannel(supabase, "signups") : (process.env.DISCORD_SIGNUPS_CHANNEL_ID ?? null);
        if (signupsChannelId && supabase) {
          const template = await resolveTemplate(supabase, "signup_thread", body.signupThreadTemplateId);
          if (template) {
            const startDate = new Date(eventRow.start_time);
            const dateStr = startDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

            const threadMessage = renderTemplate(template.sections, {
              title: eventRow.title,
              dateStr,
              host_rsn: eventRow.host_rsn,
              spots: eventRow.spots,
            });

            const { threadId, messageId } = await createSignupThread(
              signupsChannelId,
              eventRow.title,
              threadMessage
            );
            signupThreadId = threadId;
            signupThreadMessageId = messageId;
          }
        }
      } catch (threadError) {
        console.error("Signup thread creation failed:", threadError);
      }
    }

    // Save to Supabase
    if (supabase) {
      const { data, error } = await supabase
        .from("events")
        .insert({
          ...eventRow,
          discord_event_id: discordEventId,
          discord_message_id: discordMessageId,
          discord_channel_id: discordChannelId,
          signup_thread_id: signupThreadId,
          signup_thread_message_id: signupThreadMessageId,
        })
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({
        event: data,
        discord_posted: body.post_to_discord && (discordEventId || discordMessageId),
        signup_thread_created: !!signupThreadId,
        signup_thread_id: signupThreadId,
      }, { status: 201 });
    }

    // No Supabase — return what we have
    return NextResponse.json({
      event: eventRow,
      discord_event_id: discordEventId,
      discord_message_id: discordMessageId,
      discord_posted: body.post_to_discord && (discordEventId || discordMessageId),
      signup_thread_created: !!signupThreadId,
      signup_thread_id: signupThreadId,
      message: "Supabase not configured — event not persisted",
    }, { status: 201 });
  } catch (err) {
    console.error("Event creation error:", err);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}
