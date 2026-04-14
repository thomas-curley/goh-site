import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const guildId = request.nextUrl.searchParams.get("guild_id") ?? process.env.DISCORD_GUILD_ID ?? "";

  const { error } = await supabase
    .from("custom_commands")
    .delete()
    .eq("guild_id", guildId)
    .eq("name", name);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ deleted: true });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const body = await request.json();
  const guildId = body.guild_id ?? process.env.DISCORD_GUILD_ID ?? "";

  const { data, error } = await supabase
    .from("custom_commands")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("guild_id", guildId)
    .eq("name", name)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ command: data });
}
