import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createDiscordEvent, postToChannel, createSignupThread } from "@/lib/discord";
import { formatDiscordMessage, formatDiscordEventDescription } from "@/lib/discord-format";

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

        // Post formatted message to events channel
        const channelId = process.env.DISCORD_EVENTS_CHANNEL_ID;
        if (channelId) {
          // Prepend role pings if any
          let pingPrefix = "";
          if (Array.isArray(body.ping_roles) && body.ping_roles.length > 0) {
            pingPrefix = body.ping_roles.map((id: string) => {
              if (id === "@everyone") return "@everyone";
              if (id === "@here") return "@here";
              return `<@&${id}>`;
            }).join(" ") + "\n\n";
          }
          const message = pingPrefix + formatDiscordMessage(eventRow);
          // Combine banner + extra images
          const allImages: string[] = [];
          if (body.banner_url) allImages.push(body.banner_url);
          if (Array.isArray(body.extra_images)) allImages.push(...body.extra_images.filter(Boolean));
          const discordMsg = await postToChannel(channelId, message, allImages.length > 0 ? allImages : undefined);
          discordMessageId = discordMsg.id;
        }
      } catch (discordError) {
        console.error("Discord post failed:", discordError);
        // Continue — still save to Supabase even if Discord fails
      }
    }

    // Create sign-up thread if requested
    let signupThreadId: string | null = null;
    if (body.create_signup_thread) {
      try {
        const signupsChannelId = process.env.DISCORD_SIGNUPS_CHANNEL_ID;
        if (signupsChannelId) {
          const startDate = new Date(eventRow.start_time);
          const dateStr = startDate.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
          });
          const threadMessage = [
            `📋 **Sign-ups: ${eventRow.title}**`,
            "",
            `📅 ${dateStr}`,
            eventRow.host_rsn ? `🤠 Host: ${eventRow.host_rsn}` : null,
            eventRow.spots && eventRow.spots !== "Open" ? `👥 Spots: ${eventRow.spots}` : null,
            "",
            "React with ✅ to sign up, or reply with your RSN and role!",
          ].filter((l) => l !== null).join("\n");

          const { threadId } = await createSignupThread(
            signupsChannelId,
            eventRow.title,
            threadMessage
          );
          signupThreadId = threadId;
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
