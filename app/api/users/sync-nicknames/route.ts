import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: NextRequest) {
  // Auth check
  const authHeader = request.headers.get("authorization");
  const webhookSecret = process.env.DISCORD_WEBHOOK_SECRET;
  if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  if (!supabaseUrl || !serviceKey || !botToken || !guildId) {
    return NextResponse.json({ error: "Missing config" }, { status: 503 });
  }

  const supabase = createClient(supabaseUrl, serviceKey);

  // Get all profiles
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, discord_id");

  if (!profiles || profiles.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  let updated = 0;
  for (const profile of profiles) {
    if (!profile.discord_id) continue;

    try {
      const res = await fetch(
        `https://discord.com/api/v10/guilds/${guildId}/members/${profile.discord_id}`,
        { headers: { Authorization: `Bot ${botToken}` } }
      );

      if (res.ok) {
        const member = await res.json();
        const nickname = member.nick ?? null;

        await supabase
          .from("user_profiles")
          .update({ discord_nickname: nickname, updated_at: new Date().toISOString() })
          .eq("id", profile.id);

        updated++;
      }
    } catch {
      // Skip this user
    }
  }

  return NextResponse.json({ updated, total: profiles.length });
}
