import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET — list all custom commands (optionally filtered by guild_id)
export async function GET(request: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const guildId = request.nextUrl.searchParams.get("guild_id") ?? process.env.DISCORD_GUILD_ID ?? "";

  const { data, error } = await supabase
    .from("custom_commands")
    .select("*")
    .eq("guild_id", guildId)
    .order("name");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ commands: data });
}

// POST — create or update a custom command
export async function POST(request: NextRequest) {
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  try {
    const body = await request.json();
    const { name, description, spec, guild_id, created_by } = body;

    if (!name || !spec) {
      return NextResponse.json({ error: "name and spec are required" }, { status: 400 });
    }

    const guildId = guild_id ?? process.env.DISCORD_GUILD_ID ?? "";

    const { data, error } = await supabase
      .from("custom_commands")
      .upsert(
        {
          guild_id: guildId,
          name: name.toLowerCase().replace(/\s+/g, "-"),
          description: description ?? "",
          spec,
          created_by: created_by ?? "Admin",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "guild_id,name" }
      )
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ command: data }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
