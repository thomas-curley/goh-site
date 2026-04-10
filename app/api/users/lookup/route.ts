import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // Authenticate with shared secret (same as Discord webhook)
  const authHeader = request.headers.get("authorization");
  const webhookSecret = process.env.DISCORD_WEBHOOK_SECRET;

  if (webhookSecret && authHeader !== `Bearer ${webhookSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const discordId = searchParams.get("discord_id");
  const rsn = searchParams.get("rsn");

  if (!discordId && !rsn) {
    return NextResponse.json(
      { error: "Provide either discord_id or rsn query parameter" },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 503 }
    );
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(supabaseUrl, serviceKey);

  let query = supabase
    .from("user_profiles")
    .select("discord_id, discord_username, rsn, rsn_verified, clan_rank, linked_at");

  if (discordId) {
    query = query.eq("discord_id", discordId);
  } else if (rsn) {
    query = query.ilike("rsn", rsn);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    return NextResponse.json(
      { error: "User not found", discord_id: discordId, rsn },
      { status: 404 }
    );
  }

  return NextResponse.json(data);
}
