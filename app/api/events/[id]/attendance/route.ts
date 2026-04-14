import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET - fetch attendance for an event
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const { data, error } = await supabase
    .from("event_attendance")
    .select("*")
    .eq("event_id", id)
    .order("signed_up", { ascending: false })
    .order("attended", { ascending: false })
    .order("noted_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ attendance: data });
}

// POST - add or update attendance records
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json();
  const { action } = body;

  switch (action) {
    case "import_signups": {
      // Import from Discord thread reactions
      const botToken = process.env.DISCORD_BOT_TOKEN;
      const guildId = process.env.DISCORD_GUILD_ID;
      if (!botToken) return NextResponse.json({ error: "Bot token not set" }, { status: 503 });

      // Get the event to find the signup thread
      const { data: event } = await supabase
        .from("events")
        .select("title, discord_message_id")
        .eq("id", id)
        .single();

      // Try to get reactions from the signups channel message
      const signupsChannelId = process.env.DISCORD_SIGNUPS_CHANNEL_ID;
      if (!signupsChannelId || !event?.discord_message_id) {
        return NextResponse.json({ error: "No signup thread found for this event" }, { status: 404 });
      }

      // Fetch ✅ reactions from the signup message
      const reactionsRes = await fetch(
        `https://discord.com/api/v10/channels/${signupsChannelId}/messages/${event.discord_message_id}/reactions/%E2%9C%85?limit=100`,
        { headers: { Authorization: `Bot ${botToken}` } }
      );

      if (!reactionsRes.ok) {
        return NextResponse.json({ error: "Failed to fetch reactions" }, { status: 500 });
      }

      const reactors = await reactionsRes.json();
      let imported = 0;

      for (const reactor of reactors) {
        if (reactor.bot) continue;

        // Get guild nickname
        let nickname = null;
        if (guildId) {
          try {
            const memberRes = await fetch(
              `https://discord.com/api/v10/guilds/${guildId}/members/${reactor.id}`,
              { headers: { Authorization: `Bot ${botToken}` } }
            );
            if (memberRes.ok) {
              const member = await memberRes.json();
              nickname = member.nick;
            }
          } catch { /* skip */ }
        }

        // Look up RSN from user_profiles
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("rsn")
          .eq("discord_id", reactor.id)
          .maybeSingle();

        await supabase.from("event_attendance").upsert(
          {
            event_id: id,
            discord_id: reactor.id,
            discord_username: reactor.global_name ?? reactor.username,
            discord_nickname: nickname,
            rsn: profile?.rsn ?? null,
            source: "signup_reaction",
            signed_up: true,
          },
          { onConflict: "event_id,discord_id" }
        );
        imported++;
      }

      return NextResponse.json({ imported, message: `Imported ${imported} signups from reactions.` });
    }

    case "snapshot_voice": {
      // Snapshot who's in the voice channel right now
      const botToken = process.env.DISCORD_BOT_TOKEN;
      const guildId = process.env.DISCORD_GUILD_ID;
      if (!botToken || !guildId) return NextResponse.json({ error: "Discord not configured" }, { status: 503 });

      // Get voice channel from event
      const { data: event } = await supabase
        .from("events")
        .select("voice_channel")
        .eq("id", id)
        .single();

      // Fetch guild voice states
      const guildRes = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}?with_counts=false`,
        { headers: { Authorization: `Bot ${botToken}` } }
      );

      // Unfortunately, voice states require the gateway (websocket), not REST.
      // We can get voice channel members via the guild channels endpoint
      // But the most reliable way is to list guild members in voice channels.
      // For REST API, we need to use the "list guild members" endpoint and check voice_state.
      // This is a limitation — the bot would need to be connected to the gateway.
      //
      // Alternative: fetch all guild voice states (requires GUILD_VOICE_STATES intent)
      // For now, return a message suggesting manual entry or bot integration.

      return NextResponse.json({
        error: "Voice channel snapshot requires the Discord bot to be connected to the gateway. Add attendees manually or use the OSAB bot to post voice channel members.",
        suggestion: "Have your OSAB bot run a command that posts voice channel members to the /api/events/{id}/attendance endpoint.",
      }, { status: 501 });
    }

    case "mark_attended": {
      // Mark specific users as attended
      const { discord_ids, marked_by } = body;
      if (!Array.isArray(discord_ids)) {
        return NextResponse.json({ error: "discord_ids array required" }, { status: 400 });
      }

      for (const discordId of discord_ids) {
        await supabase
          .from("event_attendance")
          .update({ attended: true, marked_by })
          .eq("event_id", id)
          .eq("discord_id", discordId);
      }

      return NextResponse.json({ updated: discord_ids.length });
    }

    case "mark_not_attended": {
      const { discord_ids } = body;
      if (!Array.isArray(discord_ids)) {
        return NextResponse.json({ error: "discord_ids array required" }, { status: 400 });
      }

      for (const discordId of discord_ids) {
        await supabase
          .from("event_attendance")
          .update({ attended: false, marked_by: null })
          .eq("event_id", id)
          .eq("discord_id", discordId);
      }

      return NextResponse.json({ updated: discord_ids.length });
    }

    case "add_manual": {
      // Manually add someone
      const { discord_id, discord_username, discord_nickname, rsn, attended } = body;
      if (!discord_id && !rsn) {
        return NextResponse.json({ error: "discord_id or rsn required" }, { status: 400 });
      }

      await supabase.from("event_attendance").upsert(
        {
          event_id: id,
          discord_id: discord_id ?? `manual_${Date.now()}`,
          discord_username: discord_username ?? rsn ?? "Unknown",
          discord_nickname: discord_nickname ?? null,
          rsn: rsn ?? null,
          source: "manual",
          signed_up: false,
          attended: attended ?? true,
          marked_by: body.marked_by ?? "Admin",
        },
        { onConflict: "event_id,discord_id" }
      );

      return NextResponse.json({ added: true });
    }

    case "remove": {
      const { discord_id } = body;
      await supabase
        .from("event_attendance")
        .delete()
        .eq("event_id", id)
        .eq("discord_id", discord_id);
      return NextResponse.json({ removed: true });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
