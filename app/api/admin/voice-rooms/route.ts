import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { checkPermission } from "@/lib/check-permission";
import { getVoiceRoomSettings, sanitizeVoiceRoomSettings, saveVoiceRoomSettings } from "@/lib/voice-rooms";

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// GET / PUT - settings for the bot's /vc voice rooms.
export async function GET() {
  const { allowed } = await checkPermission("manage_settings");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  return NextResponse.json({ settings: await getVoiceRoomSettings(supabase) });
}

export async function PUT(request: NextRequest) {
  const { allowed, user } = await checkPermission("manage_settings");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = getServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const { error } = await saveVoiceRoomSettings(supabase, sanitizeVoiceRoomSettings(body.settings ?? {}), user?.id ?? null);
  if (error) return NextResponse.json({ error: "Failed to save the settings." }, { status: 500 });
  return NextResponse.json({ settings: await getVoiceRoomSettings(supabase) });
}
